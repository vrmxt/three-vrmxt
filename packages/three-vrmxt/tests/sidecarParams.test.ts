import { describe, expect, it } from 'vitest';
import { sidecarEntryToFlat, shouldGenerateOutline, textureLookupKeys } from '../src/mtoonSidecar/sidecarParams.js';

describe('sidecarEntryToFlat', () => {
  it('maps glow-like entry', () => {
    const flat = sidecarEntryToFlat({
      alphaMode: 'OPAQUE',
      color: [0.0168, 0.7157, 0.7991, 1],
      emissiveFactor: [0.0168, 0.7157, 0.7991],
      emissiveStrength: 1,
      mtoon: {
        shadeColorFactor: [0.0168, 0.7157, 0.7991],
        outlineWidthMode: 'none',
        outlineWidthFactor: 0.0015,
        textures: { matcap: { name: 'mtoon_matcap_highlight' } },
      },
    });
    expect(flat.color[0]).toBeCloseTo(0.0168);
    expect(flat.emissiveIntensity).toBe(1);
    expect(flat.outlineWidthMode).toBe('none');
    expect(flat.textureNames.matcap).toBe('mtoon_matcap_highlight');
    expect(shouldGenerateOutline(flat)).toBe(false);
  });

  it('wants outline when screen mode and width', () => {
    const flat = sidecarEntryToFlat({
      mtoon: { outlineWidthMode: 'screenCoordinates', outlineWidthFactor: 0.0015 },
    });
    expect(shouldGenerateOutline(flat)).toBe(true);
  });
});

describe('textureLookupKeys', () => {
  it('aliases png datablock names with glTF stems', () => {
    expect(textureLookupKeys('blue.png')).toEqual(expect.arrayContaining(['blue.png', 'blue']));
    expect(textureLookupKeys('mtoon_matcap_highlight')).toEqual(
      expect.arrayContaining(['mtoon_matcap_highlight', 'mtoon_matcap_highlight.png']),
    );
  });
});
