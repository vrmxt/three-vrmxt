import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CoverageMode,
  compileStencils,
  type StencilPass,
  type StencilPlan,
} from './compileStencil.js';
import {
  STENCIL_HELPER,
  STENCIL_HOLE,
  STENCIL_INSTANCE_ID,
  resetMtoonxtStencil,
  snapshotMeshRenderOrder,
  snapshotMeshSlots,
  meshStencilSourceSlots,
  snapshotStencilMaterial,
} from './resetMtoonxtStencil.js';
import { STENCIL_REF_BAND_START, acquireStencilRefBand, gpuStencilRef } from './stencilRefs.js';
import { parseRootStencilsStats, type GltfJson } from './parseStencil.js';

export type ApplyStats = { applied: number; skipped: number };

const ORDER_MASK = 10;
const ORDER_SUBJECT = 11;
const ORDER_SECONDARY = 12;
const ORDER_COVERAGE = 9;

let nextInstanceId = 1;

const COMP_FUNCS: Record<string, THREE.StencilFunc> = {
  always: THREE.AlwaysStencilFunc,
  equal: THREE.EqualStencilFunc,
  notEqual: THREE.NotEqualStencilFunc,
};

const PASS_OPS: Record<string, THREE.StencilOp> = {
  replace: THREE.ReplaceStencilOp,
  keep: THREE.KeepStencilOp,
};

const DEPTH_FUNCS: Record<string, THREE.DepthModes> = {
  never: THREE.NeverDepth,
  less: THREE.LessDepth,
  equal: THREE.EqualDepth,
  lessEqual: THREE.LessEqualDepth,
  greater: THREE.GreaterDepth,
  notEqual: THREE.NotEqualDepth,
  greaterEqual: THREE.GreaterEqualDepth,
  always: THREE.AlwaysDepth,
};

type MaterialAssoc = { type?: string; index?: number };

type Slot = { mesh: THREE.Mesh | null; material: THREE.Material };

function resolveMaterialIndex(
  parser: GLTF['parser'],
  material: THREE.Material,
  threeMaterials: THREE.Material[],
  defs: unknown[],
): number | null {
  const assoc = parser.associations?.get(material) as MaterialAssoc | number | undefined;
  if (typeof assoc === 'number' && assoc >= 0) {
    return assoc;
  }
  if (assoc && typeof assoc === 'object' && typeof assoc.index === 'number') {
    return assoc.index;
  }
  const direct = threeMaterials.indexOf(material);
  if (direct >= 0) {
    return direct;
  }
  let name = material.name;
  const suffix = ' (Outline)';
  if (name.endsWith(suffix)) {
    name = name.slice(0, -suffix.length);
  }
  const byParser = threeMaterials.findIndex((m) => m.name === name);
  if (byParser >= 0) {
    return byParser;
  }
  const byDef = defs.findIndex((d) => (d as { name?: string }).name === name);
  return byDef >= 0 ? byDef : null;
}

function instanceId(gltf: GLTF): number {
  const existing = gltf.userData[STENCIL_INSTANCE_ID];
  if (typeof existing === 'number') {
    return existing;
  }
  const id = nextInstanceId;
  nextInstanceId += 1;
  gltf.userData[STENCIL_INSTANCE_ID] = id;
  return id;
}

/**
 * Unity ApplyStencilPass: Cull Back only when cullBack && !doubleSided.
 * Keep inverted-hull outline (BackSide) — remapping that to FrontSide fills the
 * hair with the outline color.
 */
export function stencilShadingSide(cullBack: boolean, originalSide: THREE.Side): THREE.Side {
  if (originalSide === THREE.BackSide) {
    return THREE.BackSide;
  }
  return cullBack && originalSide !== THREE.DoubleSide ? THREE.FrontSide : THREE.DoubleSide;
}

function originalShadingSide(material: THREE.Material): THREE.Side {
  const snap = (material.userData as { vrmxtDepthSnap?: { side?: THREE.Side } }).vrmxtDepthSnap;
  return snap?.side ?? material.side;
}

function applyGpuPass(material: THREE.Material, pass: StencilPass, gpuRef: number): void {
  snapshotStencilMaterial(material);
  material.stencilWrite = true;
  material.stencilFuncMask = 0xff;
  material.stencilWriteMask = 0xff;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilRef = gpuRef;
  const func = COMP_FUNCS[pass.comp];
  if (func !== undefined) {
    material.stencilFunc = func;
  }
  const zPass = PASS_OPS[pass.pass];
  if (zPass !== undefined) {
    material.stencilZPass = zPass;
  }
  const depth = DEPTH_FUNCS[pass.zTest];
  if (depth !== undefined) {
    material.depthFunc = depth;
  }
  material.depthWrite = pass.zWrite;
  material.colorWrite = pass.writeColor;
  material.side = stencilShadingSide(pass.cullBack, originalShadingSide(material));
  material.needsUpdate = true;
}

function collectSlots(
  gltf: GLTF,
  threeMaterials: THREE.Material[],
  defs: unknown[],
): Map<number, Slot[]> {
  const byIndex = new Map<number, Slot[]>();
  const seen = new Set<THREE.Material>();

  const add = (material: THREE.Material, mesh: THREE.Mesh | null) => {
    if (seen.has(material)) {
      return;
    }
    const idx = resolveMaterialIndex(gltf.parser, material, threeMaterials, defs);
    if (idx === null) {
      return;
    }
    seen.add(material);
    const list = byIndex.get(idx) ?? [];
    list.push({ mesh, material });
    byIndex.set(idx, list);
  };

  gltf.scene.traverse((obj) => {
    if (obj.userData[STENCIL_HELPER] === true) {
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const slot of materials) {
      add(slot, mesh);
    }
  });

  const mtoon = gltf.userData.vrmMToonMaterials as THREE.Material[] | undefined;
  if (mtoon) {
    for (const slot of mtoon) {
      add(slot, null);
    }
  }
  return byIndex;
}

function slotsFor(byIndex: Map<number, Slot[]>, indices: number[]): Slot[] {
  const result: Slot[] = [];
  for (const index of indices) {
    const list = byIndex.get(index);
    if (!list) {
      continue;
    }
    for (const slot of list) {
      result.push(slot);
    }
  }
  return result;
}

function uniqueMeshes(slots: Slot[]): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const seen = new Set<THREE.Mesh>();
  for (const slot of slots) {
    if (!slot.mesh || seen.has(slot.mesh)) {
      continue;
    }
    seen.add(slot.mesh);
    meshes.push(slot.mesh);
  }
  return meshes;
}

function meshUsesOnlyWanted(mesh: THREE.Mesh, wanted: Set<THREE.Material>): boolean {
  return meshStencilSourceSlots(mesh).every((mat) => wanted.has(mat));
}

function hideSlotsOnMesh(mesh: THREE.Mesh, wanted: Set<THREE.Material>): void {
  snapshotMeshSlots(mesh);
  const source = meshStencilSourceSlots(mesh);
  const next = source.map((mat) => {
    if (!wanted.has(mat)) {
      return mat;
    }
    const hole = mat.clone();
    hole.userData = { [STENCIL_HOLE]: true };
    hole.visible = false;
    hole.colorWrite = false;
    hole.stencilWrite = false;
    return hole;
  });
  mesh.material = Array.isArray(mesh.material) || source.length > 1 ? next : next[0];
}

function applyPassToSlots(slots: Slot[], pass: StencilPass, gpuRef: number, renderOrder: number): void {
  const wanted = new Set(slots.map((s) => s.material));
  for (const mesh of uniqueMeshes(slots)) {
    if (meshUsesOnlyWanted(mesh, wanted)) {
      snapshotMeshRenderOrder(mesh);
      mesh.renderOrder = renderOrder;
      for (const mat of meshStencilSourceSlots(mesh)) {
        applyGpuPass(mat, pass, gpuRef);
      }
      continue;
    }
    const materials = cloneSlotMaterials(mesh, wanted, pass, gpuRef);
    cloneHelperMesh(mesh, materials, renderOrder);
    hideSlotsOnMesh(mesh, wanted);
  }
  const applied = new Set<THREE.Material>();
  for (const slot of slots) {
    if (slot.mesh || applied.has(slot.material)) {
      continue;
    }
    applied.add(slot.material);
    applyGpuPass(slot.material, pass, gpuRef);
  }
}

function cloneHelperMesh(source: THREE.Mesh, materials: THREE.Material | THREE.Material[], renderOrder: number): THREE.Mesh {
  const skinned = source as THREE.SkinnedMesh;
  const helper = skinned.isSkinnedMesh
    ? new THREE.SkinnedMesh(source.geometry, materials)
    : new THREE.Mesh(source.geometry, materials);
  if (skinned.isSkinnedMesh && (helper as THREE.SkinnedMesh).isSkinnedMesh) {
    const bound = helper as THREE.SkinnedMesh;
    bound.bindMode = skinned.bindMode;
    bound.bind(skinned.skeleton, skinned.bindMatrix);
  }
  if (source.morphTargetInfluences) {
    helper.morphTargetInfluences = source.morphTargetInfluences;
  }
  helper.userData[STENCIL_HELPER] = true;
  helper.castShadow = false;
  helper.receiveShadow = false;
  helper.renderOrder = renderOrder;
  helper.frustumCulled = source.frustumCulled;
  helper.matrixAutoUpdate = false;
  source.add(helper);
  helper.position.set(0, 0, 0);
  helper.quaternion.identity();
  helper.scale.set(1, 1, 1);
  helper.updateMatrix();
  return helper;
}

function cloneSlotMaterials(
  source: THREE.Mesh,
  wanted: Set<THREE.Material>,
  pass: StencilPass,
  gpuRef: number,
): THREE.Material | THREE.Material[] {
  const slots = meshStencilSourceSlots(source);
  const cloned = slots.map((mat) => {
    const copy = mat.clone();
    copy.userData = {};
    if (wanted.has(mat)) {
      applyGpuPass(copy, pass, gpuRef);
    } else {
      copy.visible = false;
    }
    return copy;
  });
  return Array.isArray(source.material) || slots.length > 1 ? cloned : cloned[0];
}

const COVERAGE_PASS: StencilPass = {
  comp: 'always',
  pass: 'replace',
  zTest: 'always',
  zWrite: false,
  cullBack: false,
  writeColor: false,
};

function addCoverageHelpers(
  meshes: THREE.Mesh[],
  wanted: Set<THREE.Material> | null,
  gpuRef: number,
): void {
  for (const mesh of meshes) {
    if (mesh.userData[STENCIL_HELPER] === true) {
      continue;
    }
    const slots = meshStencilSourceSlots(mesh);
    const target = wanted ?? new Set(slots);
    if (wanted && !slots.some((m) => wanted.has(m))) {
      continue;
    }
    const materials = cloneSlotMaterials(mesh, target, COVERAGE_PASS, gpuRef);
    cloneHelperMesh(mesh, materials, ORDER_COVERAGE);
  }
}

function applyPlan(
  plan: StencilPlan,
  byIndex: Map<number, Slot[]>,
  gpuBase: number,
  allMeshes: THREE.Mesh[],
): boolean {
  const writerSlots = slotsFor(byIndex, plan.source.writers);
  const readerSlots = slotsFor(byIndex, plan.source.readers);
  if (writerSlots.length === 0 || readerSlots.length === 0) {
    return false;
  }

  const gpuRef = gpuStencilRef(plan.localRef, gpuBase);
  if (gpuRef < STENCIL_REF_BAND_START) {
    return false;
  }
  const writerOrder = plan.writersStampMask ? ORDER_MASK : ORDER_SUBJECT;
  const readerOrder = plan.readersStampMask ? ORDER_MASK : ORDER_SUBJECT;
  applyPassToSlots(writerSlots, plan.writerPrimary, gpuRef, writerOrder);
  if (plan.reader) {
    applyPassToSlots(readerSlots, plan.reader, gpuRef, readerOrder);
  }

  const writerMats = new Set(writerSlots.map((s) => s.material));
  const readerMats = new Set(readerSlots.map((s) => s.material));

  if (plan.writerSecondary) {
    for (const mesh of uniqueMeshes(writerSlots)) {
      const materials = cloneSlotMaterials(mesh, writerMats, plan.writerSecondary, gpuRef);
      cloneHelperMesh(mesh, materials, ORDER_SECONDARY);
    }
  }

  if (plan.coverageMode === CoverageMode.FullReaderSilhouette) {
    addCoverageHelpers(uniqueMeshes(readerSlots), readerMats, gpuRef);
  } else if (plan.coverageMode === CoverageMode.FullSceneWithoutWriters) {
    const writerIndices = new Set(plan.source.writers);
    for (const mesh of allMeshes) {
      if (mesh.userData[STENCIL_HELPER] === true) {
        continue;
      }
      const slots = meshStencilSourceSlots(mesh);
      const nonWriter = slots.filter((mat) => {
        for (const [index, list] of byIndex) {
          if (list.some((s) => s.material === mat)) {
            return !writerIndices.has(index);
          }
        }
        return true;
      });
      if (nonWriter.length === 0) {
        continue;
      }
      const alreadyReaderStamp =
        plan.readersStampMask && nonWriter.every((mat) => readerMats.has(mat));
      if (alreadyReaderStamp) {
        continue;
      }
      addCoverageHelpers([mesh], new Set(nonWriter), gpuRef);
    }
  }

  return true;
}

export async function applyMtoonxtStencil(gltf: GLTF): Promise<ApplyStats> {
  resetMtoonxtStencil(gltf);

  const json = gltf.parser.json as GltfJson;
  const defs = json.materials ?? [];
  const parsed = parseRootStencilsStats(json);
  const plans = compileStencils(parsed.stencils, 1);
  const stats: ApplyStats = {
    applied: 0,
    skipped: parsed.skipped,
  };

  if (plans.length === 0) {
    return stats;
  }

  const threeMaterials = (await gltf.parser.getDependencies('material')) as THREE.Material[];
  const byIndex = collectSlots(gltf, threeMaterials, defs);
  const allMeshes: THREE.Mesh[] = [];
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.userData[STENCIL_HELPER] !== true) {
      allMeshes.push(mesh);
    }
  });

  const id = instanceId(gltf);
  const gpuBase = acquireStencilRefBand(id, plans.length);
  if (gpuBase < STENCIL_REF_BAND_START) {
    stats.skipped += plans.length;
    return stats;
  }

  for (const plan of plans) {
    if (applyPlan(plan, byIndex, gpuBase, allMeshes)) {
      stats.applied += 1;
    } else {
      stats.skipped += 1;
    }
  }

  return stats;
}
