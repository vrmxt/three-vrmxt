import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stencilShadingSide } from '../src/mtoonxt/applyMtoonxtStencil.js';

describe('stencilShadingSide', () => {
  it('keeps double-sided materials double-sided when writers self-occlude', () => {
    expect(stencilShadingSide(true, THREE.DoubleSide)).toBe(THREE.DoubleSide);
  });

  it('culls back faces on single-sided writers that self-occlude', () => {
    expect(stencilShadingSide(true, THREE.FrontSide)).toBe(THREE.FrontSide);
  });

  it('disables culling when the pass does not self-occlude', () => {
    expect(stencilShadingSide(false, THREE.FrontSide)).toBe(THREE.DoubleSide);
  });

  it('keeps inverted-hull outline on the back side', () => {
    expect(stencilShadingSide(true, THREE.BackSide)).toBe(THREE.BackSide);
    expect(stencilShadingSide(false, THREE.BackSide)).toBe(THREE.BackSide);
  });
});
