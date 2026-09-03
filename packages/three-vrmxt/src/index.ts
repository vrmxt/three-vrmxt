export { VRMXTLoaderPlugin, tryAttach, applyMtoonxtStencil } from './VRMXTLoaderPlugin.js';
export type { MtoonxtAttachResult, VrmxtAttachResult } from './tryAttach.js';
export { applyMtoonSidecar } from './mtoonSidecar/applyMtoonSidecar.js';
export type { ApplyMtoonSidecarResult } from './mtoonSidecar/applyMtoonSidecar.js';
export { sidecarEntryToFlat, shouldGenerateOutline, textureLookupKeys, MTOON_SIDECAR_KIND } from './mtoonSidecar/sidecarParams.js';
export type { MtoonSidecarDocument, SidecarMaterial } from './mtoonSidecar/sidecarParams.js';
export { resetMtoonxtStencil } from './mtoonxt/resetMtoonxtStencil.js';
export {
  assignStencilRefs,
  type StencilExtra,
  type StencilOpName,
} from './mtoonxt/stencilRefs.js';
export {
  EXT_MTOONXT,
  cloneJson,
  ensureMtoonxtUsed,
  listStencilMaterials,
  sanitizeMtoonxtStencils,
  setMaterialStencilExtras,
  type GltfJson,
  type StencilMaterialRow,
} from './mtoonxt/editStencil.js';
export { buildGlb, isGlb, parseGlb, type GlbParts } from './gltf/glbCodec.js';
export { appendImageToGlbBin, sniffImageMime, type GlbJsonForPack } from './gltf/packImage.js';
export {
  EXT_SPRITE_PARTICLE,
  parseSpriteParticle,
  type SpriteParticleEmitter,
  type SpriteParticleExtension,
} from './vfx/parseSpriteParticle.js';
export {
  EDIT_EMISSION_RATE,
  EDIT_LIFETIME,
  addSpriteParticleEmitter,
  listGltfNodes,
  listGltfTextures,
  listSpriteParticleEmitters,
  removeSpriteParticleEmitter,
  sanitizeSpriteParticles,
  setSpriteParticleEmitter,
  type GltfNodeOption,
  type GltfTextureOption,
  type ParticleGltfJson,
  type SpriteParticlePatch,
  type SpriteParticleRow,
} from './vfx/editSpriteParticle.js';
export { attachSpriteParticle, disposeSpriteParticles } from './vfx/attachSpriteParticle.js';
export { VrmxtSpriteParticleManager } from './vfx/spriteParticleRuntime.js';
