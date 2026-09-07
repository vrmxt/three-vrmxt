import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { releaseStencilRefBand } from './stencilRefs.js';

const DEPTH_SNAP = 'vrmxtDepthSnap';
const STENCIL_MARK = 'vrmxtStencilApplied';
const ORDER_SNAP = 'vrmxtRenderOrderSnap';
export const STENCIL_HELPER = 'vrmxtStencilHelper';
export const STENCIL_INSTANCE_ID = 'vrmxtStencilInstanceId';

type StencilSnap = {
  depthFunc: THREE.DepthModes;
  depthWrite: boolean;
  stencilWrite: boolean;
  stencilFunc: THREE.StencilFunc;
  stencilRef: number;
  stencilFuncMask: number;
  stencilWriteMask: number;
  stencilFail: THREE.StencilOp;
  stencilZFail: THREE.StencilOp;
  stencilZPass: THREE.StencilOp;
  colorWrite: boolean;
  side: THREE.Side;
};

function asMesh(obj: THREE.Object3D): THREE.Mesh | null {
  const mesh = obj as THREE.Mesh;
  return mesh.isMesh ? mesh : null;
}

function slotList(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

export function snapshotStencilMaterial(material: THREE.Material): void {
  const data = material.userData as Record<string, unknown>;
  if (!data[DEPTH_SNAP]) {
    data[DEPTH_SNAP] = {
      depthFunc: material.depthFunc,
      depthWrite: material.depthWrite,
      stencilWrite: material.stencilWrite,
      stencilFunc: material.stencilFunc,
      stencilRef: material.stencilRef,
      stencilFuncMask: material.stencilFuncMask,
      stencilWriteMask: material.stencilWriteMask,
      stencilFail: material.stencilFail,
      stencilZFail: material.stencilZFail,
      stencilZPass: material.stencilZPass,
      colorWrite: material.colorWrite,
      side: material.side,
    } satisfies StencilSnap;
  }
  data[STENCIL_MARK] = true;
}

export function snapshotMeshRenderOrder(mesh: THREE.Mesh): void {
  const data = mesh.userData as Record<string, unknown>;
  if (data[ORDER_SNAP] === undefined) {
    data[ORDER_SNAP] = mesh.renderOrder;
  }
}

function clearStencilFlags(material: THREE.Material): void {
  const data = material.userData as Record<string, unknown>;
  if (!data[STENCIL_MARK]) {
    return;
  }
  const snap = data[DEPTH_SNAP] as StencilSnap | undefined;
  if (snap) {
    material.depthFunc = snap.depthFunc;
    material.depthWrite = snap.depthWrite;
    material.stencilWrite = snap.stencilWrite;
    material.stencilFunc = snap.stencilFunc;
    material.stencilRef = snap.stencilRef;
    material.stencilFuncMask = snap.stencilFuncMask;
    material.stencilWriteMask = snap.stencilWriteMask;
    material.stencilFail = snap.stencilFail;
    material.stencilZFail = snap.stencilZFail;
    material.stencilZPass = snap.stencilZPass;
    material.colorWrite = snap.colorWrite;
    material.side = snap.side;
  } else {
    material.stencilWrite = false;
    material.stencilFunc = THREE.AlwaysStencilFunc;
    material.stencilRef = 0;
    material.stencilFuncMask = 0xff;
    material.stencilWriteMask = 0xff;
    material.stencilFail = THREE.KeepStencilOp;
    material.stencilZFail = THREE.KeepStencilOp;
    material.stencilZPass = THREE.KeepStencilOp;
  }
  material.needsUpdate = true;
  delete data[DEPTH_SNAP];
  delete data[STENCIL_MARK];
}

function restoreMeshOrder(mesh: THREE.Mesh): void {
  const data = mesh.userData as Record<string, unknown>;
  if (data[ORDER_SNAP] === undefined) {
    return;
  }
  mesh.renderOrder = data[ORDER_SNAP] as number;
  delete data[ORDER_SNAP];
}

function disposeHelperMaterials(mesh: THREE.Mesh): void {
  for (const slot of slotList(mesh)) {
    slot.dispose();
  }
}

export function resetMtoonxtStencil(gltf: GLTF): void {
  const helpers: THREE.Object3D[] = [];
  gltf.scene.traverse((obj) => {
    if (obj.userData[STENCIL_HELPER] === true) {
      helpers.push(obj);
    }
  });
  for (const helper of helpers) {
    helper.parent?.remove(helper);
    const mesh = asMesh(helper);
    if (mesh) {
      disposeHelperMaterials(mesh);
    }
  }

  gltf.scene.traverse((obj) => {
    const mesh = asMesh(obj);
    if (!mesh) {
      return;
    }
    restoreMeshOrder(mesh);
    for (const slot of slotList(mesh)) {
      clearStencilFlags(slot);
    }
  });
  const mtoon = gltf.userData.vrmMToonMaterials as THREE.Material[] | undefined;
  if (mtoon) {
    for (const slot of mtoon) {
      clearStencilFlags(slot);
    }
  }

  const id = gltf.userData[STENCIL_INSTANCE_ID];
  if (typeof id === 'number') {
    releaseStencilRefBand(id);
  }
}
