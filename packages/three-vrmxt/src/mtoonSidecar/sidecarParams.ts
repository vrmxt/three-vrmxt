
export const MTOON_SIDECAR_KIND = 'mtoon-sidecar';

export type SidecarTextureRef = {
  name?: string;
  filepath?: string;
};

export type SidecarMtoonBlock = {
  shadeColorFactor?: number[];
  shadingToonyFactor?: number;
  shadingShiftFactor?: number;
  giEqualizationFactor?: number;
  matcapFactor?: number[];
  parametricRimColorFactor?: number[];
  parametricRimFresnelPowerFactor?: number;
  parametricRimLiftFactor?: number;
  rimLightingMixFactor?: number;
  outlineWidthMode?: string;
  outlineWidthFactor?: number;
  outlineColorFactor?: number[];
  outlineLightingMixFactor?: number;
  uvAnimationScrollXSpeedFactor?: number;
  uvAnimationScrollYSpeedFactor?: number;
  uvAnimationRotationSpeedFactor?: number;
  textures?: Partial<
    Record<
      'base' | 'shade' | 'matcap' | 'normal' | 'emissive' | 'rim' | 'outlineWidth' | 'uvAnimMask',
      SidecarTextureRef
    >
  >;
};

export type SidecarMaterial = {
  alphaMode?: string;
  doubleSided?: boolean;
  color?: number[];
  emissiveFactor?: number[];
  emissiveStrength?: number;
  mtoon?: SidecarMtoonBlock;
};

export type MtoonSidecarDocument = {
  specVersion?: string;
  kind?: string;
  materials?: Record<string, SidecarMaterial>;
};

function rgb3(rgb: number[] | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!rgb || rgb.length < 3) return fallback;
  return [rgb[0], rgb[1], rgb[2]];
}

export type FlatMtoonParams = {
  color: [number, number, number];
  emissive: [number, number, number];
  emissiveIntensity: number;
  shadeColorFactor: [number, number, number];
  shadingToonyFactor: number;
  shadingShiftFactor: number;
  giEqualizationFactor: number;
  matcapFactor: [number, number, number];
  parametricRimColorFactor: [number, number, number];
  parametricRimFresnelPowerFactor: number;
  parametricRimLiftFactor: number;
  rimLightingMixFactor: number;
  outlineWidthMode: string;
  outlineWidthFactor: number;
  outlineColorFactor: [number, number, number];
  outlineLightingMixFactor: number;
  uvAnimationScrollXSpeedFactor: number;
  uvAnimationScrollYSpeedFactor: number;
  uvAnimationRotationSpeedFactor: number;
  transparent: boolean;
  alphaTest: number;
  doubleSided: boolean;
  textureNames: Partial<Record<'map' | 'shade' | 'matcap' | 'normal' | 'emissive' | 'rim' | 'outlineWidth' | 'uvAnimMask', string>>;
};

export function sidecarEntryToFlat(entry: SidecarMaterial): FlatMtoonParams {
  const m = entry.mtoon ?? {};
  const tex = m.textures ?? {};
  const nameOf = (ref?: SidecarTextureRef) => ref?.name;
  return {
    color: rgb3(entry.color, [1, 1, 1]),
    emissive: rgb3(entry.emissiveFactor, [0, 0, 0]),
    emissiveIntensity: entry.emissiveStrength ?? 1,
    shadeColorFactor: rgb3(m.shadeColorFactor, [1, 1, 1]),
    shadingToonyFactor: m.shadingToonyFactor ?? 0.9,
    shadingShiftFactor: m.shadingShiftFactor ?? 0,
    giEqualizationFactor: m.giEqualizationFactor ?? 1,
    matcapFactor: rgb3(m.matcapFactor, [1, 1, 1]),
    parametricRimColorFactor: rgb3(m.parametricRimColorFactor, [0, 0, 0]),
    parametricRimFresnelPowerFactor: m.parametricRimFresnelPowerFactor ?? 1,
    parametricRimLiftFactor: m.parametricRimLiftFactor ?? 0,
    rimLightingMixFactor: m.rimLightingMixFactor ?? 0,
    outlineWidthMode: m.outlineWidthMode ?? 'none',
    outlineWidthFactor: m.outlineWidthFactor ?? 0,
    outlineColorFactor: rgb3(m.outlineColorFactor, [0, 0, 0]),
    outlineLightingMixFactor: m.outlineLightingMixFactor ?? 1,
    uvAnimationScrollXSpeedFactor: m.uvAnimationScrollXSpeedFactor ?? 0,
    uvAnimationScrollYSpeedFactor: m.uvAnimationScrollYSpeedFactor ?? 0,
    uvAnimationRotationSpeedFactor: m.uvAnimationRotationSpeedFactor ?? 0,
    transparent: entry.alphaMode === 'BLEND',
    alphaTest: entry.alphaMode === 'MASK' ? 0.5 : 0,
    doubleSided: entry.doubleSided !== false,
    textureNames: {
      map: nameOf(tex.base),
      shade: nameOf(tex.shade),
      matcap: nameOf(tex.matcap),
      normal: nameOf(tex.normal),
      emissive: nameOf(tex.emissive),
      rim: nameOf(tex.rim),
      outlineWidth: nameOf(tex.outlineWidth),
      uvAnimMask: nameOf(tex.uvAnimMask),
    },
  };
}

export function shouldGenerateOutline(flat: Pick<FlatMtoonParams, 'outlineWidthMode' | 'outlineWidthFactor'>): boolean {
  return flat.outlineWidthMode !== 'none' && flat.outlineWidthFactor > 0;
}

/** glTF image names often drop `.png`; sidecar dump keeps the datablock basename. */
export function textureLookupKeys(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const keys = [trimmed];
  const lower = trimmed.toLowerCase();
  if (lower !== trimmed) keys.push(lower);
  const dot = trimmed.lastIndexOf('.');
  if (dot > 0) {
    const stem = trimmed.slice(0, dot);
    keys.push(stem, stem.toLowerCase());
  } else {
    keys.push(`${trimmed}.png`, `${trimmed}.jpg`, `${lower}.png`);
  }
  return [...new Set(keys)];
}
