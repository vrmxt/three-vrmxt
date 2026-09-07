export const EXT_MTOON = 'VRMC_materials_mtoon';
export const EXT_MTOONXT = 'VRMXT_materials_mtoonxt';
export const MTOONXT_SPEC_VERSION = '1.0';

export type GltfJson = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  extensions?: Record<string, unknown>;
  materials?: unknown[];
};

export type MtoonxtStencil = {
  writers: number[];
  readers: number[];
  comparison: 'inside' | 'outside';
  showWritersThroughOccluders: boolean;
  writersOnlyInsideReaders: boolean;
  writersOnlyOutsideReaders: boolean;
  writersSelfOcclude: boolean;
  ignoreOccludedReaderAreas: boolean;
  writersWriteColor: boolean;
  writersWriteDepth: boolean;
  readersWriteDepth: boolean;
  writerDepthTest: string;
  readerDepthTest: string;
};

const COMPARISONS = new Set(['inside', 'outside']);
const DEPTH_TESTS = new Set([
  'never',
  'less',
  'equal',
  'lessEqual',
  'greater',
  'notEqual',
  'greaterEqual',
  'always',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function materialExts(def: unknown): Record<string, unknown> | null {
  const rec = asRecord(def);
  if (!rec) {
    return null;
  }
  return asRecord(rec.extensions);
}

export function materialHasSiblingMtoon(def: unknown): boolean {
  const ext = materialExts(def);
  return ext !== null && asRecord(ext[EXT_MTOON]) !== null;
}

function parseIndices(value: unknown, materialCount: number): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const indices: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isInteger(item) || (item as number) < 0) {
      return null;
    }
    const index = item as number;
    if (materialCount >= 0 && index >= materialCount) {
      return null;
    }
    if (!seen.has(index)) {
      seen.add(index);
      indices.push(index);
    }
  }
  return indices.length > 0 ? indices : null;
}

function boolOrDefault(obj: Record<string, unknown>, key: string, fallback: boolean): boolean | null {
  if (!(key in obj)) {
    return fallback;
  }
  return typeof obj[key] === 'boolean' ? (obj[key] as boolean) : null;
}

function intersects(left: number[], right: number[]): boolean {
  const set = new Set(left);
  return right.some((i) => set.has(i));
}

export function parseStencil(raw: unknown, materialCount: number): MtoonxtStencil | null {
  const obj = asRecord(raw);
  if (!obj) {
    return null;
  }
  const writers = parseIndices(obj.writers, materialCount);
  const readers = parseIndices(obj.readers, materialCount);
  if (!writers || !readers || intersects(writers, readers)) {
    return null;
  }
  const comparison = typeof obj.comparison === 'string' ? obj.comparison : 'outside';
  const writerDepthTest = typeof obj.writerDepthTest === 'string' ? obj.writerDepthTest : 'lessEqual';
  const readerDepthTest = typeof obj.readerDepthTest === 'string' ? obj.readerDepthTest : 'lessEqual';
  if (!COMPARISONS.has(comparison) || !DEPTH_TESTS.has(writerDepthTest) || !DEPTH_TESTS.has(readerDepthTest)) {
    return null;
  }
  const showWritersThroughOccluders = boolOrDefault(obj, 'showWritersThroughOccluders', false);
  const writersOnlyInsideReaders = boolOrDefault(obj, 'writersOnlyInsideReaders', false);
  const writersOnlyOutsideReaders = boolOrDefault(obj, 'writersOnlyOutsideReaders', false);
  const writersSelfOcclude = boolOrDefault(obj, 'writersSelfOcclude', true);
  const ignoreOccludedReaderAreas = boolOrDefault(obj, 'ignoreOccludedReaderAreas', true);
  const writersWriteColor = boolOrDefault(obj, 'writersWriteColor', true);
  const writersWriteDepth = boolOrDefault(obj, 'writersWriteDepth', true);
  const readersWriteDepth = boolOrDefault(obj, 'readersWriteDepth', true);
  if (
    showWritersThroughOccluders === null ||
    writersOnlyInsideReaders === null ||
    writersOnlyOutsideReaders === null ||
    writersSelfOcclude === null ||
    ignoreOccludedReaderAreas === null ||
    writersWriteColor === null ||
    writersWriteDepth === null ||
    readersWriteDepth === null ||
    (writersOnlyInsideReaders && writersOnlyOutsideReaders)
  ) {
    return null;
  }
  return {
    writers,
    readers,
    comparison: comparison as 'inside' | 'outside',
    showWritersThroughOccluders,
    writersOnlyInsideReaders,
    writersOnlyOutsideReaders,
    writersSelfOcclude,
    ignoreOccludedReaderAreas,
    writersWriteColor,
    writersWriteDepth,
    readersWriteDepth,
    writerDepthTest,
    readerDepthTest,
  };
}

export function parseRootStencils(json: GltfJson): MtoonxtStencil[] {
  const root = asRecord(asRecord(json.extensions)?.[EXT_MTOONXT]);
  if (!root || root.specVersion !== MTOONXT_SPEC_VERSION) {
    return [];
  }
  const raw = root.stencil;
  if (!Array.isArray(raw)) {
    return [];
  }
  const defs = json.materials ?? [];
  const materialCount = defs.length;
  const result: MtoonxtStencil[] = [];
  for (const entry of raw) {
    const parsed = parseStencil(entry, materialCount);
    if (!parsed) {
      continue;
    }
    const participants = [...parsed.writers, ...parsed.readers];
    if (participants.some((index) => !materialHasSiblingMtoon(defs[index]))) {
      continue;
    }
    result.push(parsed);
  }
  return result;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeRootStencils(stencils: MtoonxtStencil[]): Record<string, unknown> {
  return {
    specVersion: MTOONXT_SPEC_VERSION,
    stencil: stencils.map(serializeStencil),
  };
}

export function writeRootStencils(json: GltfJson, stencils: MtoonxtStencil[]): void {
  if (stencils.length === 0) {
    const extensions = asRecord(json.extensions);
    if (!extensions) {
      ensureMtoonxtUsed(json);
      return;
    }
    const current = asRecord(extensions[EXT_MTOONXT]);
    if (current) {
      delete current.stencil;
      const leftover = Object.keys(current).filter((key) => key !== 'specVersion');
      if (leftover.length === 0) {
        delete extensions[EXT_MTOONXT];
      }
    }
    if (Object.keys(extensions).length === 0) {
      delete json.extensions;
    }
    ensureMtoonxtUsed(json);
    return;
  }
  const extensions = asRecord(json.extensions) ?? {};
  if (!json.extensions) {
    json.extensions = extensions;
  }
  const current = asRecord(extensions[EXT_MTOONXT]) ?? {};
  current.specVersion = MTOONXT_SPEC_VERSION;
  current.stencil = stencils.map(serializeStencil);
  extensions[EXT_MTOONXT] = current;
  ensureMtoonxtUsed(json);
}

function anyMtoonxt(json: GltfJson): boolean {
  if (asRecord(asRecord(json.extensions)?.[EXT_MTOONXT])) {
    return true;
  }
  for (const def of json.materials ?? []) {
    const xt = asRecord(asRecord(asRecord(def)?.extensions)?.[EXT_MTOONXT]);
    if (xt) {
      return true;
    }
  }
  return false;
}

export function ensureMtoonxtUsed(json: GltfJson): void {
  if (!anyMtoonxt(json)) {
    if (json.extensionsUsed) {
      json.extensionsUsed = json.extensionsUsed.filter((n) => n !== EXT_MTOONXT);
      if (json.extensionsUsed.length === 0) {
        delete json.extensionsUsed;
      }
    }
    return;
  }
  const used = json.extensionsUsed ? [...json.extensionsUsed] : [];
  if (!used.includes(EXT_MTOONXT)) {
    used.push(EXT_MTOONXT);
  }
  json.extensionsUsed = used;
  if (json.extensionsRequired) {
    json.extensionsRequired = json.extensionsRequired.filter((n) => n !== EXT_MTOONXT);
    if (json.extensionsRequired.length === 0) {
      delete json.extensionsRequired;
    }
  }
}

export function serializeStencil(stencil: MtoonxtStencil): Record<string, unknown> {
  const out: Record<string, unknown> = {
    writers: [...stencil.writers],
    readers: [...stencil.readers],
  };
  const optional: Array<[string, unknown, unknown]> = [
    ['comparison', stencil.comparison, 'outside'],
    ['showWritersThroughOccluders', stencil.showWritersThroughOccluders, false],
    ['writersOnlyInsideReaders', stencil.writersOnlyInsideReaders, false],
    ['writersOnlyOutsideReaders', stencil.writersOnlyOutsideReaders, false],
    ['writersSelfOcclude', stencil.writersSelfOcclude, true],
    ['ignoreOccludedReaderAreas', stencil.ignoreOccludedReaderAreas, true],
    ['writersWriteColor', stencil.writersWriteColor, true],
    ['writersWriteDepth', stencil.writersWriteDepth, true],
    ['readersWriteDepth', stencil.readersWriteDepth, true],
    ['writerDepthTest', stencil.writerDepthTest, 'lessEqual'],
    ['readerDepthTest', stencil.readerDepthTest, 'lessEqual'],
  ];
  for (const [key, value, fallback] of optional) {
    if (value !== fallback) {
      out[key] = value;
    }
  }
  return out;
}
