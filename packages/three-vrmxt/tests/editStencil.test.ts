import { describe, expect, it } from 'vitest';
import { buildGlb, isGlb, parseGlb } from '../src/gltf/glbCodec.js';
import {
  EXT_MTOONXT,
  cloneJson,
  listMtoonMaterials,
  listStencils,
  sanitizeMtoonxtStencils,
  setStencils,
  type GltfJson,
  type MtoonxtStencil,
} from '../src/mtoonxt/editStencil.js';

function mtoonMat(name: string, extra?: unknown): unknown {
  const extensions: Record<string, unknown> = {
    VRMC_materials_mtoon: { specVersion: '1.0' },
  };
  if (extra) {
    extensions.VRMXT_materials_mtoonxt = extra;
  }
  return { name, extensions };
}

function stencil(partial: Partial<MtoonxtStencil> & Pick<MtoonxtStencil, 'writers' | 'readers'>): MtoonxtStencil {
  return {
    comparison: 'outside',
    showWritersThroughOccluders: false,
    writersOnlyInsideReaders: false,
    writersOnlyOutsideReaders: false,
    writersSelfOcclude: true,
    ignoreOccludedReaderAreas: true,
    writersWriteColor: true,
    writersWriteDepth: true,
    readersWriteDepth: true,
    writerDepthTest: 'lessEqual',
    readerDepthTest: 'lessEqual',
    ...partial,
  };
}

function rootXt(json: GltfJson): Record<string, unknown> | undefined {
  return json.extensions?.[EXT_MTOONXT] as Record<string, unknown> | undefined;
}

describe('glbCodec', () => {
  it('round-trips JSON and BIN with 4-byte padding', () => {
    const json = { asset: { version: '2.0' }, extras: { n: 1 } };
    const bin = new Uint8Array([1, 2, 3]);
    const bytes = buildGlb(json, bin);
    expect(isGlb(bytes)).toBe(true);
    expect(bytes.byteLength % 4).toBe(0);
    const parsed = parseGlb(bytes);
    expect(parsed?.json).toEqual(json);
    expect([...parsed!.bin!.subarray(0, 3)]).toEqual([1, 2, 3]);
    expect(parsed!.bin!.byteLength % 4).toBe(0);
  });

  it('parses JSON-only GLB', () => {
    const json = { asset: { version: '2.0' } };
    const parsed = parseGlb(buildGlb(json, null));
    expect(parsed?.json).toEqual(json);
    expect(parsed?.bin).toBeNull();
  });

  it('returns null for non-GLB', () => {
    const text = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    expect(parseGlb(text.buffer)).toBeNull();
  });
});

describe('setStencils', () => {
  it('writes root stencil and never nested ops or extensionsRequired', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), mtoonMat('Hair')],
    };
    expect(
      setStencils(json, [
        stencil({
          writers: [1],
          readers: [0],
          showWritersThroughOccluders: true,
        }),
      ]),
    ).toBe(true);
    expect(json.extensionsUsed).toEqual([EXT_MTOONXT]);
    expect(json.extensionsRequired).toBeUndefined();
    expect(rootXt(json)).toEqual({
      specVersion: '1.0',
      stencil: [
        {
          writers: [1],
          readers: [0],
          showWritersThroughOccluders: true,
        },
      ],
    });
    const face = json.materials![0] as { extensions: Record<string, unknown> };
    const hair = json.materials![1] as { extensions: Record<string, unknown> };
    expect(face.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(hair.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(listStencils(json)).toHaveLength(1);
  });

  it('clears the graph and extensionsUsed', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), mtoonMat('Hair')],
    };
    setStencils(json, [stencil({ writers: [1], readers: [0] })]);
    expect(setStencils(json, [])).toBe(true);
    expect(rootXt(json)).toBeUndefined();
    expect(json.extensionsUsed).toBeUndefined();
  });
});

describe('sanitizeMtoonxtStencils', () => {
  it('strips leftover nested ops', () => {
    const json: GltfJson = {
      extensionsUsed: [EXT_MTOONXT],
      materials: [
        mtoonMat('A', { specVersion: '1.0', stencil: { op: 'inside', materials: [1] } }),
        mtoonMat('B', { specVersion: '1.0', stencil: { op: 'write' } }),
      ],
    };
    const clone = cloneJson(json);
    sanitizeMtoonxtStencils(clone);
    const a = clone.materials![0] as { extensions: Record<string, unknown> };
    const b = clone.materials![1] as { extensions: Record<string, unknown> };
    expect(a.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(b.extensions.VRMXT_materials_mtoonxt).toBeUndefined();
    expect(clone.extensionsUsed).toBeUndefined();
  });
});

describe('listMtoonMaterials', () => {
  it('reports sibling MToon without nested stencil extras', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), { name: 'PBR' }],
    };
    expect(listMtoonMaterials(json)).toEqual([
      { index: 0, name: 'Face', hasMtoon: true },
      { index: 1, name: 'PBR', hasMtoon: false },
    ]);
  });
});
