import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyMtoonxtStencil } from './mtoonxt/applyMtoonxtStencil.js';
import { attachSpriteParticle } from './vfx/attachSpriteParticle.js';
import type { VrmxtSpriteParticleManager } from './vfx/spriteParticleRuntime.js';

export type MtoonxtAttachResult = {
  mtoonxtApplied: number;
  mtoonxtSkipped: number;
};

export type VrmxtAttachResult = MtoonxtAttachResult & {
  spriteParticleApplied: number;
  spriteParticleSkipped: number;
  spriteParticles: VrmxtSpriteParticleManager | null;
};

/**
 * Attach VRMXT extras after a stock three-vrm (or GLTF) load.
 * Missing extensions: no-op.
 */
export async function tryAttach(gltf: GLTF): Promise<VrmxtAttachResult> {
  const json = gltf.parser.json as {
    extensionsUsed?: string[];
    materials?: unknown[];
  };
  const used = json.extensionsUsed ?? [];
  const result: VrmxtAttachResult = {
    mtoonxtApplied: 0,
    mtoonxtSkipped: 0,
    spriteParticleApplied: 0,
    spriteParticleSkipped: 0,
    spriteParticles: null,
  };

  if (used.includes('VRMXT_materials_mtoonxt')) {
    const stats = await applyMtoonxtStencil(gltf);
    result.mtoonxtApplied = stats.applied;
    result.mtoonxtSkipped = stats.skipped;
  }

  const particles = await attachSpriteParticle(gltf);
  result.spriteParticleApplied = particles.spriteParticleApplied;
  result.spriteParticleSkipped = particles.spriteParticleSkipped;
  result.spriteParticles = particles.spriteParticles;

  gltf.userData.vrmxt = {
    ...(typeof gltf.userData.vrmxt === 'object' && gltf.userData.vrmxt !== null
      ? gltf.userData.vrmxt
      : {}),
    ...result,
  };

  return result;
}
