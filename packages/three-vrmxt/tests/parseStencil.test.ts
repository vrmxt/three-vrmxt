import { describe, expect, it } from 'vitest';
import {
  EXT_MTOONXT,
  MTOONXT_SPEC_VERSION,
  parseRootStencils,
  serializeRootStencils,
  type GltfJson,
  type MtoonxtStencil,
} from '../src/mtoonxt/parseStencil.js';

function mtoonMat(name: string, extra?: unknown): unknown {
  const extensions: Record<string, unknown> = {
    VRMC_materials_mtoon: { specVersion: '1.0' },
  };
  if (extra) {
    extensions.VRMXT_materials_mtoonxt = extra;
  }
  return { name, extensions };
}

function fullStencil(partial: Partial<MtoonxtStencil> & Pick<MtoonxtStencil, 'writers' | 'readers'>): MtoonxtStencil {
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

describe('parseRootStencils', () => {
  it('parses writers[1] readers[0] with showThrough true and fills defaults', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), mtoonMat('Hair')],
      extensions: {
        [EXT_MTOONXT]: {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: [
            {
              writers: [1],
              readers: [0],
              showWritersThroughOccluders: true,
            },
          ],
        },
      },
    };
    const stencils = parseRootStencils(json);
    expect(stencils).toHaveLength(1);
    expect(stencils[0]).toEqual(
      fullStencil({
        writers: [1],
        readers: [0],
        showWritersThroughOccluders: true,
      }),
    );
  });

  it('does not treat retired stencilRelationships as an alias', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), mtoonMat('Hair')],
      extensions: {
        [EXT_MTOONXT]: {
          specVersion: MTOONXT_SPEC_VERSION,
          stencilRelationships: [
            {
              writers: [1],
              readers: [0],
              showWritersThroughOccluders: true,
            },
          ],
        },
      },
    };
    expect(parseRootStencils(json)).toEqual([]);
  });

  it('ignores nested per-material stencil ops', () => {
    const json: GltfJson = {
      materials: [
        mtoonMat('Face', {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: { op: 'write' },
        }),
        mtoonMat('Hair', {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: { op: 'outside', materials: [0] },
          outlineStencil: { op: 'same' },
        }),
      ],
    };
    expect(parseRootStencils(json)).toEqual([]);
  });

  it('skips overlapping writers and readers', () => {
    const json: GltfJson = {
      materials: [mtoonMat('A'), mtoonMat('B')],
      extensions: {
        [EXT_MTOONXT]: {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: [{ writers: [0], readers: [0] }],
        },
      },
    };
    expect(parseRootStencils(json)).toEqual([]);
  });

  it('skips entries whose participants lack sibling MToon', () => {
    const json: GltfJson = {
      materials: [mtoonMat('Face'), { name: 'PBR' }],
      extensions: {
        [EXT_MTOONXT]: {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: [{ writers: [1], readers: [0] }],
        },
      },
    };
    expect(parseRootStencils(json)).toEqual([]);
  });

  it('skips an invalid row and keeps the next', () => {
    const json: GltfJson = {
      materials: [mtoonMat('A'), mtoonMat('B')],
      extensions: {
        [EXT_MTOONXT]: {
          specVersion: MTOONXT_SPEC_VERSION,
          stencil: [
            { writers: [0], readers: [0] },
            { writers: [0], readers: [1] },
          ],
        },
      },
    };
    const stencils = parseRootStencils(json);
    expect(stencils).toHaveLength(1);
    expect(stencils[0].writers).toEqual([0]);
    expect(stencils[0].readers).toEqual([1]);
  });
});

describe('serializeRootStencils', () => {
  it('omits defaults and writes non-default showThrough / writersWriteColor', () => {
    const serialized = serializeRootStencils([
      fullStencil({
        writers: [1],
        readers: [0],
        showWritersThroughOccluders: true,
        writersWriteColor: false,
        readersWriteDepth: true,
      }),
    ]);
    expect(serialized.specVersion).toBe(MTOONXT_SPEC_VERSION);
    const row = (serialized.stencil as Record<string, unknown>[])[0];
    expect(row.writers).toEqual([1]);
    expect(row.readers).toEqual([0]);
    expect(row.showWritersThroughOccluders).toBe(true);
    expect(row.writersWriteColor).toBe(false);
    expect(row.readersWriteDepth).toBeUndefined();
    expect(row.comparison).toBeUndefined();
    expect(row.writersWriteDepth).toBeUndefined();
  });
});
