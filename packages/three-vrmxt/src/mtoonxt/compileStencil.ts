import type { MtoonxtStencil } from './parseStencil.js';

export type { MtoonxtStencil };

export type StencilPass = {
  comp: string;
  pass: string;
  zTest: string;
  zWrite: boolean;
  cullBack: boolean;
  writeColor: boolean;
};

export const CoverageMode = {
  None: 'None',
  FullSceneWithoutWriters: 'FullSceneWithoutWriters',
  FullReaderSilhouette: 'FullReaderSilhouette',
} as const;

export type CoverageMode = (typeof CoverageMode)[keyof typeof CoverageMode];

export type StencilPlan = {
  source: MtoonxtStencil;
  localRef: number;
  writerPrimary: StencilPass;
  writerSecondary: StencilPass | null;
  reader: StencilPass | null;
  writersStampMask: boolean;
  readersStampMask: boolean;
  coverageMode: CoverageMode;
};

function sameSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((v) => right.includes(v));
}

function samePresentation(left: MtoonxtStencil, right: MtoonxtStencil): boolean {
  return (
    left.comparison === right.comparison &&
    left.showWritersThroughOccluders === right.showWritersThroughOccluders &&
    left.writersOnlyInsideReaders === right.writersOnlyInsideReaders &&
    left.writersOnlyOutsideReaders === right.writersOnlyOutsideReaders &&
    left.writersSelfOcclude === right.writersSelfOcclude &&
    left.ignoreOccludedReaderAreas === right.ignoreOccludedReaderAreas &&
    left.writersWriteColor === right.writersWriteColor &&
    left.writersWriteDepth === right.writersWriteDepth &&
    left.readersWriteDepth === right.readersWriteDepth &&
    left.writerDepthTest === right.writerDepthTest &&
    left.readerDepthTest === right.readerDepthTest
  );
}

function withIndices(stencil: MtoonxtStencil, writers: number[], readers: number[]): MtoonxtStencil {
  return { ...stencil, writers, readers };
}

function coalesceCompatibleStencils(stencils: MtoonxtStencil[]): MtoonxtStencil[] {
  const result: MtoonxtStencil[] = [];
  for (const stencil of stencils) {
    let match = -1;
    let mergeWriters = false;
    for (let j = 0; j < result.length; j++) {
      const existing = result[j];
      if (sameSet(existing.writers, stencil.writers) && samePresentation(existing, stencil)) {
        match = j;
        break;
      }
      if (sameSet(existing.readers, stencil.readers) && samePresentation(existing, stencil)) {
        match = j;
        mergeWriters = true;
        break;
      }
    }
    if (match < 0) {
      result.push(stencil);
      continue;
    }
    if (mergeWriters) {
      const writers = [...result[match].writers];
      for (const writer of stencil.writers) {
        if (!writers.includes(writer) && !result[match].readers.includes(writer)) {
          writers.push(writer);
        }
      }
      result[match] = withIndices(result[match], writers, result[match].readers);
      continue;
    }
    const readers = [...result[match].readers];
    for (const reader of stencil.readers) {
      if (!readers.includes(reader) && !result[match].writers.includes(reader)) {
        readers.push(reader);
      }
    }
    result[match] = withIndices(result[match], result[match].writers, readers);
  }
  return result;
}

function mask(zTest: string, zWrite: boolean, writeColor = true): StencilPass {
  return {
    comp: 'always',
    pass: 'replace',
    zTest,
    zWrite,
    cullBack: false,
    writeColor,
  };
}

function subject(
  comp: string,
  zTest: string,
  zWrite: boolean,
  cullBack: boolean,
  writeColor = true,
): StencilPass {
  return {
    comp,
    pass: 'keep',
    zTest,
    zWrite,
    cullBack,
    writeColor,
  };
}

function compileOne(stencil: MtoonxtStencil, localRef: number): StencilPlan {
  const writerDepth = stencil.writerDepthTest;
  const readerDepth = stencil.readerDepthTest;
  const cullBack = stencil.writersSelfOcclude;

  if (stencil.writersOnlyInsideReaders) {
    return {
      source: stencil,
      localRef,
      writerPrimary: subject(
        'equal',
        stencil.showWritersThroughOccluders ? 'always' : writerDepth,
        stencil.writersWriteDepth,
        cullBack,
        stencil.writersWriteColor,
      ),
      writerSecondary: null,
      reader: mask(readerDepth, stencil.readersWriteDepth),
      writersStampMask: false,
      readersStampMask: true,
      coverageMode: stencil.ignoreOccludedReaderAreas
        ? CoverageMode.None
        : CoverageMode.FullReaderSilhouette,
    };
  }

  if (stencil.writersOnlyOutsideReaders) {
    const backgroundOnly = stencil.showWritersThroughOccluders;
    return {
      source: stencil,
      localRef,
      writerPrimary: subject(
        'notEqual',
        writerDepth,
        stencil.writersWriteDepth,
        cullBack,
        stencil.writersWriteColor,
      ),
      writerSecondary: null,
      reader: backgroundOnly ? null : mask(readerDepth, stencil.readersWriteDepth),
      writersStampMask: false,
      readersStampMask: !backgroundOnly,
      coverageMode: backgroundOnly
        ? CoverageMode.FullSceneWithoutWriters
        : stencil.ignoreOccludedReaderAreas
          ? CoverageMode.None
          : CoverageMode.FullReaderSilhouette,
    };
  }

  if (stencil.showWritersThroughOccluders) {
    return {
      source: stencil,
      localRef,
      writerPrimary: subject(
        'notEqual',
        writerDepth,
        stencil.writersWriteDepth,
        cullBack,
        stencil.writersWriteColor,
      ),
      writerSecondary: subject(
        'equal',
        'always',
        stencil.writersWriteDepth,
        cullBack,
        stencil.writersWriteColor,
      ),
      reader: mask(readerDepth, stencil.readersWriteDepth),
      writersStampMask: false,
      readersStampMask: true,
      coverageMode: stencil.ignoreOccludedReaderAreas
        ? CoverageMode.None
        : CoverageMode.FullReaderSilhouette,
    };
  }

  const readerComp = stencil.comparison === 'inside' ? 'equal' : 'notEqual';
  return {
    source: stencil,
    localRef,
    writerPrimary: mask(writerDepth, stencil.writersWriteDepth, stencil.writersWriteColor),
    writerSecondary: null,
    reader: subject(readerComp, readerDepth, stencil.readersWriteDepth, false),
    writersStampMask: true,
    readersStampMask: false,
    coverageMode: CoverageMode.None,
  };
}

export function compileStencils(stencils: MtoonxtStencil[], firstLocalRef: number): StencilPlan[] {
  const compiled = coalesceCompatibleStencils(stencils);
  const result: StencilPlan[] = [];
  let nextRef = Math.max(1, firstLocalRef);
  for (const stencil of compiled) {
    if (nextRef > 255) {
      break;
    }
    result.push(compileOne(stencil, nextRef));
    nextRef += 1;
  }
  return result;
}
