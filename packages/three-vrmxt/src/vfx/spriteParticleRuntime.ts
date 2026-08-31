import * as THREE from 'three';
import type { SpriteParticleEmitter } from './parseSpriteParticle.js';

type Slot = {
  alive: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

const _origin = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _camQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
const _parentInverse = new THREE.Matrix4();

function spriteQuadGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1 - uv.getY(i));
  }
  uv.needsUpdate = true;
  return geometry;
}

function emitterObjectName(emitter: SpriteParticleEmitter, index: number): string {
  const label = (emitter.name ?? 'Emitter').trim() || 'Emitter';
  return `VRMXT_sprite_particle_${label}_${index}`;
}

export class SpriteParticleEmitterRuntime {
  public readonly mesh: THREE.InstancedMesh;
  private readonly node: THREE.Object3D;
  private readonly parent: THREE.Object3D;
  private readonly slots: Slot[];
  private readonly width: number;
  private readonly height: number;
  private readonly emissionRate: number;
  private readonly lifetime: number;
  private readonly startSpeed: number;
  private spawnAcc = 0;

  public constructor(
    emitter: SpriteParticleEmitter,
    node: THREE.Object3D,
    parent: THREE.Object3D,
    texture: THREE.Texture | null,
    index: number,
  ) {
    this.node = node;
    this.parent = parent;
    this.width = emitter.size[0];
    this.height = emitter.size[1];
    this.emissionRate = emitter.emissionRate;
    this.lifetime = emitter.lifetime;
    this.startSpeed = emitter.startSpeed;

    const cap = emitter.maxParticles;
    this.slots = Array.from({ length: cap }, () => ({
      alive: false,
      age: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));

    const geometry = spriteQuadGeometry();
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color().setRGB(
        emitter.color[0],
        emitter.color[1],
        emitter.color[2],
        THREE.LinearSRGBColorSpace,
      ),
      opacity: emitter.color[3],
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (texture) {
      material.needsUpdate = true;
    }

    const mesh = new THREE.InstancedMesh(geometry, material, cap);
    mesh.name = emitterObjectName(emitter, index);
    mesh.frustumCulled = false;
    mesh.count = cap;
    mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh = mesh;
    parent.add(mesh);
    this.hideAll();
  }

  public update(delta: number, camera: THREE.Camera): void {
    const dt = Math.max(0, delta);
    this.node.updateWorldMatrix(true, false);
    _origin.setFromMatrixPosition(this.node.matrixWorld);
    _vel.set(0, 1, 0).transformDirection(this.node.matrixWorld);
    if (_vel.lengthSq() > 1e-12) {
      _vel.normalize().multiplyScalar(this.startSpeed);
    } else {
      _vel.set(0, 0, 0);
    }

    if (this.lifetime > 0 && this.emissionRate > 0) {
      this.spawnAcc += this.emissionRate * dt;
      while (this.spawnAcc >= 1) {
        if (!this.spawn(_origin, _vel)) {
          break;
        }
        this.spawnAcc -= 1;
      }
    }

    const cam = camera;
    cam.updateMatrixWorld();
    cam.getWorldQuaternion(_camQuat);
    this.parent.updateWorldMatrix(true, false);
    this.parent.getWorldQuaternion(_parentQuat);
    _parentQuat.invert();
    _parentInverse.copy(this.parent.matrixWorld).invert();
    let dirty = false;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (!slot.alive) {
        continue;
      }
      slot.age += dt;
      if (slot.age >= this.lifetime) {
        slot.alive = false;
        this.hideIndex(i);
        dirty = true;
        continue;
      }
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.z += slot.vz * dt;
      _dummy.position.set(slot.x, slot.y, slot.z);
      _dummy.position.applyMatrix4(_parentInverse);
      _dummy.quaternion.copy(_camQuat).premultiply(_parentQuat);
      _dummy.scale.set(this.width, this.height, 1);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      dirty = true;
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) {
      for (const mat of material) {
        mat.dispose();
      }
    } else {
      material.dispose();
    }
  }

  private spawn(origin: THREE.Vector3, vel: THREE.Vector3): boolean {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (slot.alive) {
        continue;
      }
      slot.alive = true;
      slot.age = 0;
      slot.x = origin.x;
      slot.y = origin.y;
      slot.z = origin.z;
      slot.vx = vel.x;
      slot.vy = vel.y;
      slot.vz = vel.z;
      return true;
    }
    return false;
  }

  private hideAll(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.hideIndex(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private hideIndex(index: number): void {
    _dummy.position.set(0, 0, 0);
    _dummy.quaternion.identity();
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(index, _dummy.matrix);
  }
}

export class VrmxtSpriteParticleManager {
  public readonly emitters: SpriteParticleEmitterRuntime[] = [];

  public update(delta: number, camera: THREE.Camera): void {
    for (const emitter of this.emitters) {
      emitter.update(delta, camera);
    }
  }

  public dispose(): void {
    for (const emitter of this.emitters) {
      emitter.dispose();
    }
    this.emitters.length = 0;
  }
}
