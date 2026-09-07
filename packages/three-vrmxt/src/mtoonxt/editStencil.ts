export {
  EXT_MTOON,
  EXT_MTOONXT,
  cloneJson,
  ensureMtoonxtUsed,
  type GltfJson,
  type MtoonxtStencil,
} from './parseStencil.js';

import {
  EXT_MTOONXT,
  ensureMtoonxtUsed,
  materialHasSiblingMtoon,
  parseRootStencils,
  serializeRootStencils,
  writeRootStencils,
  type GltfJson,
  type MtoonxtStencil,
} from './parseStencil.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stripNestedStencilOps(json: GltfJson): void {
  for (const def of json.materials ?? []) {
    if (!isRecord(def) || !isRecord(def.extensions)) {
      continue;
    }
    const xt = def.extensions[EXT_MTOONXT];
    if (!isRecord(xt)) {
      continue;
    }
    delete xt.stencil;
    delete xt.outlineStencil;
    const leftover = Object.keys(xt).filter((key) => key !== 'specVersion');
    if (leftover.length === 0) {
      delete def.extensions[EXT_MTOONXT];
      if (Object.keys(def.extensions).length === 0) {
        delete def.extensions;
      }
    }
  }
}

export function sanitizeMtoonxtStencils(json: GltfJson): void {
  stripNestedStencilOps(json);
  writeRootStencils(json, parseRootStencils(json));
  ensureMtoonxtUsed(json);
}

export function listStencils(json: GltfJson): MtoonxtStencil[] {
  return parseRootStencils(json);
}

export function setStencils(json: GltfJson, stencils: MtoonxtStencil[]): boolean {
  if (!Array.isArray(json.materials)) {
    return false;
  }
  const valid = parseRootStencils({
    materials: json.materials,
    extensions: { [EXT_MTOONXT]: serializeRootStencils(stencils) },
  });
  writeRootStencils(json, valid);
  stripNestedStencilOps(json);
  ensureMtoonxtUsed(json);
  return true;
}

export function listMtoonMaterials(
  json: GltfJson,
): { index: number; name: string; hasMtoon: boolean }[] {
  return (json.materials ?? []).map((def, index) => {
    const rec = isRecord(def) ? def : null;
    return {
      index,
      name: typeof rec?.name === 'string' ? rec.name : `Material ${index}`,
      hasMtoon: materialHasSiblingMtoon(def),
    };
  });
}
