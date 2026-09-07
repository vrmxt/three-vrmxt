import { describe, expect, it } from 'vitest';
import {
  compileStencils,
  type CoverageMode,
  type MtoonxtStencil,
  type StencilPass,
  type StencilPlan,
} from '../src/mtoonxt/compileStencil.js';

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

function bool(value: boolean): string {
  return value ? '1' : '0';
}

function pass(value: StencilPass | null): string {
  if (!value) {
    return '-';
  }
  return `${value.comp}/${value.pass}/${value.zTest}/${bool(value.zWrite)}/${bool(value.cullBack)}`;
}

function snapshot(plan: StencilPlan): string {
  const coverage: CoverageMode = plan.coverageMode;
  return (
    `W=${pass(plan.writerPrimary)};S=${pass(plan.writerSecondary)};R=${pass(plan.reader)}` +
    `;WS=${bool(plan.writersStampMask)};RS=${bool(plan.readersStampMask)};C=${coverage}`
  );
}

describe('compileStencils matrix', () => {
  const rows: Array<{
    row: string;
    showThrough: boolean;
    insideOnly: boolean;
    outsideOnly: boolean;
    selfOcclude: boolean;
    ignoreOccludedReaders: boolean;
    writersWriteDepth: boolean;
    readersWriteDepth: boolean;
    comparison: MtoonxtStencil['comparison'];
    writerDepth: MtoonxtStencil['writerDepthTest'];
    readerDepth: MtoonxtStencil['readerDepthTest'];
    expected: string;
  }> = [
    {
      row: 'M01',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=always/replace/lessEqual/1/0;S=-;R=notEqual/keep/lessEqual/1/0;WS=1;RS=0;C=None',
    },
    {
      row: 'M02',
      showThrough: true,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected:
        'W=notEqual/keep/lessEqual/1/1;S=equal/keep/always/1/1;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=None',
    },
    {
      row: 'M03',
      showThrough: false,
      insideOnly: true,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=equal/keep/lessEqual/1/1;S=-;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=None',
    },
    {
      row: 'M04',
      showThrough: true,
      insideOnly: true,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=equal/keep/always/1/1;S=-;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=None',
    },
    {
      row: 'M05',
      showThrough: false,
      insideOnly: false,
      outsideOnly: true,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=notEqual/keep/lessEqual/1/1;S=-;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=None',
    },
    {
      row: 'M06',
      showThrough: true,
      insideOnly: false,
      outsideOnly: true,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=notEqual/keep/lessEqual/1/1;S=-;R=-;WS=0;RS=0;C=FullSceneWithoutWriters',
    },
    {
      row: 'M07',
      showThrough: true,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: false,
      ignoreOccludedReaders: true,
      writersWriteDepth: false,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected:
        'W=notEqual/keep/lessEqual/0/0;S=equal/keep/always/0/0;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=None',
    },
    {
      row: 'M08',
      showThrough: true,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: false,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected:
        'W=notEqual/keep/lessEqual/1/1;S=equal/keep/always/1/1;R=always/replace/lessEqual/1/0;WS=0;RS=1;C=FullReaderSilhouette',
    },
    {
      row: 'M09',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: false,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=always/replace/lessEqual/0/0;S=-;R=notEqual/keep/lessEqual/1/0;WS=1;RS=0;C=None',
    },
    {
      row: 'M10',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: false,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=always/replace/lessEqual/1/0;S=-;R=notEqual/keep/lessEqual/0/0;WS=1;RS=0;C=None',
    },
    {
      row: 'A01',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'inside',
      writerDepth: 'lessEqual',
      readerDepth: 'lessEqual',
      expected: 'W=always/replace/lessEqual/1/0;S=-;R=equal/keep/lessEqual/1/0;WS=1;RS=0;C=None',
    },
    {
      row: 'A02',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'always',
      readerDepth: 'lessEqual',
      expected: 'W=always/replace/always/1/0;S=-;R=notEqual/keep/lessEqual/1/0;WS=1;RS=0;C=None',
    },
    {
      row: 'A03',
      showThrough: false,
      insideOnly: false,
      outsideOnly: false,
      selfOcclude: true,
      ignoreOccludedReaders: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      comparison: 'outside',
      writerDepth: 'lessEqual',
      readerDepth: 'always',
      expected: 'W=always/replace/lessEqual/1/0;S=-;R=notEqual/keep/always/1/0;WS=1;RS=0;C=None',
    },
  ];

  for (const caseRow of rows) {
    it(`${caseRow.row} matches Unity pass plan`, () => {
      const plans = compileStencils(
        [
          stencil({
            writers: [0],
            readers: [1],
            comparison: caseRow.comparison,
            showWritersThroughOccluders: caseRow.showThrough,
            writersOnlyInsideReaders: caseRow.insideOnly,
            writersOnlyOutsideReaders: caseRow.outsideOnly,
            writersSelfOcclude: caseRow.selfOcclude,
            ignoreOccludedReaderAreas: caseRow.ignoreOccludedReaders,
            writersWriteDepth: caseRow.writersWriteDepth,
            readersWriteDepth: caseRow.readersWriteDepth,
            writerDepthTest: caseRow.writerDepth,
            readerDepthTest: caseRow.readerDepth,
          }),
        ],
        1,
      );
      expect(plans).toHaveLength(1);
      expect(snapshot(plans[0]!)).toBe(caseRow.expected);
    });
  }
});

describe('compileStencils coalesce', () => {
  it('same readers and presentation unions writers', () => {
    const first = stencil({
      writers: [0],
      readers: [4, 5],
      comparison: 'outside',
      showWritersThroughOccluders: true,
      writersOnlyInsideReaders: false,
      writersOnlyOutsideReaders: false,
      writersSelfOcclude: true,
      ignoreOccludedReaderAreas: true,
      writersWriteDepth: true,
      readersWriteDepth: true,
      writerDepthTest: 'lessEqual',
      readerDepthTest: 'lessEqual',
    });
    const second = stencil({ ...first, writers: [1], readers: [4, 5] });
    const third = stencil({ ...first, writers: [2, 3], readers: [4, 5] });
    const plans = compileStencils([first, second, third], 1);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.source.writers).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    expect(plans[0]!.source.writers).toHaveLength(4);
    expect(plans[0]!.source.readers).toEqual(expect.arrayContaining([4, 5]));
    expect(plans[0]!.source.readers).toHaveLength(2);
  });

  it('same writers unions readers', () => {
    const plans = compileStencils(
      [
        stencil({ writers: [0], readers: [1], writersWriteColor: false }),
        stencil({ writers: [0], readers: [2], writersWriteColor: false }),
      ],
      1,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]!.source.readers).toEqual(expect.arrayContaining([1, 2]));
    expect(plans[0]!.source.readers).toHaveLength(2);
  });
});
