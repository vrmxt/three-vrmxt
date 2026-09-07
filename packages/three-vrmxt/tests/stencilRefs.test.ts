import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STENCIL_REF_BAND_START,
  acquireStencilRefBand,
  gpuStencilRef,
  releaseStencilRefBand,
  resetStencilRefBands,
} from '../src/mtoonxt/stencilRefs.js';

describe('stencilRefs', () => {
  beforeEach(() => {
    resetStencilRefBands();
  });

  afterEach(() => {
    resetStencilRefBands();
  });

  it('first span starts at band', () => {
    expect(acquireStencilRefBand(1, 1)).toBe(STENCIL_REF_BAND_START);
    expect(gpuStencilRef(1, 32)).toBe(32);
  });

  it('second instance advances', () => {
    expect(acquireStencilRefBand(1, 2)).toBe(32);
    expect(acquireStencilRefBand(2, 1)).toBe(34);
  });

  it('release recycles band', () => {
    expect(acquireStencilRefBand(1, 1)).toBe(32);
    expect(acquireStencilRefBand(2, 1)).toBe(33);
    releaseStencilRefBand(1);
    expect(acquireStencilRefBand(3, 1)).toBe(32);
  });

  it('same instance replaces lease', () => {
    expect(acquireStencilRefBand(1, 2)).toBe(32);
    expect(acquireStencilRefBand(1, 1)).toBe(32);
    expect(acquireStencilRefBand(2, 1)).toBe(33);
  });

  it('skips Poiyomi fake shadow 51', () => {
    expect(acquireStencilRefBand(1, 20)).toBe(52);
  });

  it('gpu ref without base keeps local', () => {
    expect(gpuStencilRef(1, 0)).toBe(1);
  });
});
