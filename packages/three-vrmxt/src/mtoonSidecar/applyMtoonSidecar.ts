import * as THREE from 'three';
import { MToonMaterial } from '@pixiv/three-vrm-materials-mtoon';
import type { MToonMaterialOutlineWidthMode } from '@pixiv/three-vrm-materials-mtoon';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { sidecarEntryToFlat, shouldGenerateOutline, textureLookupKeys, type MtoonSidecarDocument } from './sidecarParams.js';

export const MTOON_SIDECAR_PACK_PREFIX = 'MToonSidecarPack';

export type ApplyMtoonSidecarResult = {
  applied: number;
  skipped: number;
  missing: string[];
};

const MAP_KEYS = [
  'map',
  'normalMap',
  'emissiveMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'alphaMap',
] as const;

function rememberTexture(map: Map<string, THREE.Texture>, key: string, tex: THREE.Texture): void {
  for (const alias of textureLookupKeys(key)) {
    if (!map.has(alias)) map.set(alias, tex);
  }
}

function collectTextures(root: THREE.Object3D): Map<string, THREE.Texture> {
  const map = new Map<string, THREE.Texture>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || typeof mat !== 'object') continue;
      for (const key of MAP_KEYS) {
        const tex = (mat as THREE.MeshStandardMaterial)[key];
        if (tex instanceof THREE.Texture) {
          if (tex.name) rememberTexture(map, tex.name, tex);
          const img = tex.image as { name?: string } | undefined;
          if (img?.name) rememberTexture(map, img.name, tex);
        }
      }
    }
  });
  return map;
}

function pickTexture(textures: Map<string, THREE.Texture>, name?: string): THREE.Texture | null {
  if (!name) return null;
  for (const key of textureLookupKeys(name)) {
    const hit = textures.get(key);
    if (hit) return hit;
  }
  return null;
}

function removePackDummies(root: THREE.Object3D): void {
  const dump: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.name.startsWith(MTOON_SIDECAR_PACK_PREFIX)) dump.push(obj);
  });
  for (const obj of dump) obj.removeFromParent();
}

function c(rgb: [number, number, number]): THREE.Color {
  return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

function makeMtoon(
  name: string,
  entry: NonNullable<MtoonSidecarDocument['materials']>[string],
  textures: Map<string, THREE.Texture>,
): MToonMaterial {
  const flat = sidecarEntryToFlat(entry);
  const pick = (n?: string) => pickTexture(textures, n);
  const mtoon = new MToonMaterial({
    color: c(flat.color),
    emissive: c(flat.emissive),
    emissiveIntensity: flat.emissiveIntensity,
    shadeColorFactor: c(flat.shadeColorFactor),
    shadingToonyFactor: flat.shadingToonyFactor,
    shadingShiftFactor: flat.shadingShiftFactor,
    giEqualizationFactor: flat.giEqualizationFactor,
    matcapFactor: c(flat.matcapFactor),
    parametricRimColorFactor: c(flat.parametricRimColorFactor),
    parametricRimFresnelPowerFactor: flat.parametricRimFresnelPowerFactor,
    parametricRimLiftFactor: flat.parametricRimLiftFactor,
    rimLightingMixFactor: flat.rimLightingMixFactor,
    outlineWidthMode: flat.outlineWidthMode as MToonMaterialOutlineWidthMode,
    outlineWidthFactor: flat.outlineWidthFactor,
    outlineColorFactor: c(flat.outlineColorFactor),
    outlineLightingMixFactor: flat.outlineLightingMixFactor,
    uvAnimationScrollXSpeedFactor: flat.uvAnimationScrollXSpeedFactor,
    uvAnimationScrollYSpeedFactor: flat.uvAnimationScrollYSpeedFactor,
    uvAnimationRotationSpeedFactor: flat.uvAnimationRotationSpeedFactor,
    transparent: flat.transparent,
    alphaTest: flat.alphaTest,
    side: flat.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    map: pick(flat.textureNames.map) ?? undefined,
    shadeMultiplyTexture: pick(flat.textureNames.shade) ?? undefined,
    matcapTexture: pick(flat.textureNames.matcap) ?? undefined,
    normalMap: pick(flat.textureNames.normal) ?? undefined,
    emissiveMap: pick(flat.textureNames.emissive) ?? undefined,
    rimMultiplyTexture: pick(flat.textureNames.rim) ?? undefined,
    outlineWidthMultiplyTexture: pick(flat.textureNames.outlineWidth) ?? undefined,
    uvAnimationMaskTexture: pick(flat.textureNames.uvAnimMask) ?? undefined,
  });
  mtoon.name = name;
  return mtoon;
}

function attachWithOutline(mesh: THREE.Mesh, surface: MToonMaterial): void {
  if (
    !shouldGenerateOutline({
      outlineWidthMode: surface.outlineWidthMode,
      outlineWidthFactor: surface.outlineWidthFactor ?? 0,
    })
  ) {
    mesh.material = surface;
    return;
  }
  const outline = surface.clone();
  outline.name += ' (Outline)';
  outline.isOutline = true;
  outline.side = THREE.BackSide;
  mesh.material = [surface, outline];
  const geometry = mesh.geometry;
  const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
  geometry.clearGroups();
  geometry.addGroup(0, count, 0);
  geometry.addGroup(0, count, 1);
}

export function applyMtoonSidecar(gltf: GLTF, sidecar: MtoonSidecarDocument): ApplyMtoonSidecarResult {
  const catalog = sidecar.materials ?? {};
  const textures = collectTextures(gltf.scene);
  removePackDummies(gltf.scene);
  const missing: string[] = [];
  let applied = 0;
  let skipped = 0;

  gltf.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const replaced: MToonMaterial[] = [];
    let allHit = true;
    for (const mat of list) {
      const name = mat?.name ?? '';
      const entry = catalog[name];
      if (!entry) {
        skipped += 1;
        allHit = false;
        if (name && !missing.includes(name)) missing.push(name);
        continue;
      }
      replaced.push(makeMtoon(name, entry, textures));
      applied += 1;
    }
    if (!allHit || replaced.length === 0) return;
    if (replaced.length === 1) attachWithOutline(obj, replaced[0]);
    else obj.material = replaced;
  });

  gltf.userData.mtoonSidecar = { applied, skipped, missing };
  return { applied, skipped, missing };
}
