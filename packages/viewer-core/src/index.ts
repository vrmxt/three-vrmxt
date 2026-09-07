import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  addSpriteParticleEmitter,
  appendImageToGlbBin,
  buildGlb,
  cloneJson,
  listGltfNodes,
  listGltfTextures,
  listMtoonMaterials,
  listSpriteParticleEmitters,
  listStencils,
  parseGlb,
  removeSpriteParticleEmitter,
  resetMtoonxtStencil,
  sanitizeMtoonxtStencils,
  sanitizeSpriteParticles,
  setStencils as writeGltfStencils,
  setSpriteParticleEmitter,
  sniffImageMime,
  tryAttach,
  disposeSpriteParticles,
  STENCIL_HELPER,
  type GltfJson,
  type GltfNodeOption,
  type GltfTextureOption,
  type GlbJsonForPack,
  type ParticleGltfJson,
  type SpriteParticlePatch,
  type SpriteParticleRow,
  type MtoonxtStencil,
  type VrmxtAttachResult,
  type VrmxtSpriteParticleManager,
} from '@vrmxt/three-vrmxt';

export type { MtoonxtStencil, SpriteParticleRow, GltfNodeOption, GltfTextureOption };

export type ViewerStatus = {
  name: string;
  vrmxtEnabled: boolean;
  mtoonxtApplied: number;
  mtoonxtSkipped: number;
  spriteParticleApplied: number;
  spriteParticleSkipped: number;
};

export type ViewerLoadStage = 'parsing' | 'applying';

export type ViewerLoadOptions = {
  onStage?: (stage: ViewerLoadStage) => void;
};

export type ViewerLights = {
  directionalEnabled: boolean;
  directionalColor: string;
  directionalIntensity: number;
  directionalAzimuth: number;
  directionalElevation: number;
  ambientColor: string;
  ambientIntensity: number;
};

export type ViewerShadows = {
  enabled: boolean;
  modelCast: boolean;
  modelReceive: boolean;
  ground: boolean;
  intensity: number;
  bias: number;
  normalBias: number;
  mapSize: 512 | 1024 | 2048;
};

export type VrmxtViewer = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loadBytes: (
    bytes: ArrayBuffer,
    name: string,
    opts?: ViewerLoadOptions,
  ) => Promise<ViewerStatus>;
  getVrmxtEnabled: () => boolean;
  setVrmxtEnabled: (enabled: boolean, opts?: ViewerLoadOptions) => Promise<ViewerStatus | null>;
  getLights: () => ViewerLights;
  setLights: (next: Partial<ViewerLights>) => ViewerLights;
  matchLightToCamera: () => ViewerLights;
  resetView: () => void;
  getShadows: () => ViewerShadows;
  setShadows: (next: Partial<ViewerShadows>) => ViewerShadows;
  getStencils: () => MtoonxtStencil[];
  getMtoonMaterials: () => { index: number; name: string; hasMtoon: boolean }[];
  setStencils: (stencils: MtoonxtStencil[]) => Promise<ViewerStatus | null>;
  getGltfNodes: () => GltfNodeOption[];
  getGltfTextures: () => GltfTextureOption[];
  getSpriteParticleEmitters: () => SpriteParticleRow[];
  setSpriteParticleEmitter: (
    index: number,
    patch: SpriteParticlePatch,
  ) => Promise<ViewerStatus | null>;
  addSpriteParticleEmitter: (node?: number) => Promise<ViewerStatus | null>;
  removeSpriteParticleEmitter: (index: number) => Promise<ViewerStatus | null>;
  packSpriteParticleTexture: (
    emitterIndex: number,
    imageBytes: ArrayBuffer,
    fileName: string,
  ) => Promise<ViewerStatus | null>;
  canExportGlb: () => boolean;
  exportGlb: () => ArrayBuffer | null;
  getSourceName: () => string | null;
  dispose: () => void;
};

type VrmInstance = {
  scene: THREE.Group;
  update: (delta: number) => void;
};

export function createVrmxtViewer(canvas: HTMLCanvasElement): VrmxtViewer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    stencil: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1e);

  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const DEFAULT_POS = new THREE.Vector3(0, 1.3, 2.4);
  const DEFAULT_TARGET = new THREE.Vector3(0, 1.0, 0);
  const VIEW_HELPER_SIZE = 128;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.copy(DEFAULT_POS);
  camera.up.copy(WORLD_UP);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(DEFAULT_TARGET);
  controls.update();

  const framedPos = DEFAULT_POS.clone();
  const framedTarget = DEFAULT_TARGET.clone();
  const framedUp = WORLD_UP.clone();
  let hasFramed = false;

  function applyView(position: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3): void {
    camera.up.copy(up);
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  }

  function saveFramed(): void {
    framedPos.copy(camera.position);
    framedTarget.copy(controls.target);
    framedUp.copy(camera.up);
    hasFramed = true;
  }

  function frameObject(root: THREE.Object3D | null): void {
    if (!root) {
      applyView(DEFAULT_POS, DEFAULT_TARGET, WORLD_UP);
      saveFramed();
      return;
    }
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    applyView(
      new THREE.Vector3(center.x, center.y + size * 0.15, center.z + size * 1.1),
      center,
      WORLD_UP,
    );
    saveFramed();
  }

  function resetView(): void {
    if (hasFramed) {
      applyView(framedPos, framedTarget, framedUp);
      return;
    }
    frameObject(current);
  }

  const viewHelperHost = document.createElement('div');
  viewHelperHost.setAttribute('aria-label', 'View axis');
  viewHelperHost.style.cssText = [
    'position:absolute',
    'left:0',
    'bottom:0',
    `width:${VIEW_HELPER_SIZE}px`,
    `height:${VIEW_HELPER_SIZE}px`,
    'z-index:1',
  ].join(';');
  (canvas.parentElement ?? document.body).appendChild(viewHelperHost);

  const viewHelper = new ViewHelper(camera, viewHelperHost);
  viewHelper.center = controls.target;
  viewHelper.setLabels('X', 'Y', 'Z');

  function restoreOrbitIfIdle(): void {
    if (!viewHelper.animating) {
      controls.enabled = true;
    }
  }

  function onHelperPointerDown(event: PointerEvent): void {
    event.stopPropagation();
    controls.enabled = false;
    viewHelperHost.setPointerCapture(event.pointerId);
  }

  function onHelperPointerUp(event: PointerEvent): void {
    event.stopPropagation();
    viewHelper.handleClick(event);
    restoreOrbitIfIdle();
  }

  function onHelperPointerCancel(): void {
    restoreOrbitIfIdle();
  }

  viewHelperHost.addEventListener('pointerdown', onHelperPointerDown);
  viewHelperHost.addEventListener('pointerup', onHelperPointerUp);
  viewHelperHost.addEventListener('pointercancel', onHelperPointerCancel);
  viewHelperHost.addEventListener('lostpointercapture', onHelperPointerCancel);

  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(1.6, 2.8, 2.2);
  directional.castShadow = true;
  directional.shadow.intensity = 0.85;
  directional.shadow.bias = -0.0002;
  directional.shadow.normalBias = 0.02;
  directional.shadow.mapSize.set(1024, 1024);
  directional.shadow.camera.near = 0.2;
  directional.shadow.camera.far = 24;
  scene.add(directional);
  scene.add(directional.target);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ opacity: 0.35, color: 0x000000 }),
  );
  ground.name = 'ShadowGround';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  let shadowOpts: ViewerShadows = {
    enabled: true,
    modelCast: true,
    modelReceive: true,
    ground: true,
    intensity: 0.85,
    bias: -0.0002,
    normalBias: 0.02,
    mapSize: 1024,
  };

  let lightAim = { azimuth: 41, elevation: 46 };
  let directionalEnabled = true;

  function colorHex(color: THREE.Color): string {
    return `#${color.getHexString()}`;
  }

  const clock = new THREE.Clock();
  let current: THREE.Object3D | null = null;
  let currentGltf: GLTF | null = null;
  let glbBin: Uint8Array | null | undefined;
  let vrmUpdate: ((delta: number) => void) | null = null;
  let spriteParticles: VrmxtSpriteParticleManager | null = null;
  let vrmxtEnabled = true;
  let lastSource: { bytes: ArrayBuffer; name: string } | null = null;
  let loadGen = 0;

  function getLights(): ViewerLights {
    return {
      directionalEnabled,
      directionalColor: colorHex(directional.color),
      directionalIntensity: directional.intensity,
      directionalAzimuth: lightAim.azimuth,
      directionalElevation: lightAim.elevation,
      ambientColor: colorHex(ambient.color),
      ambientIntensity: ambient.intensity,
    };
  }

  function setLights(next: Partial<ViewerLights>): ViewerLights {
    if (next.directionalEnabled !== undefined) {
      directionalEnabled = next.directionalEnabled;
    }
    if (next.directionalColor !== undefined) {
      directional.color.set(next.directionalColor);
    }
    if (next.directionalIntensity !== undefined) {
      directional.intensity = next.directionalIntensity;
    }
    if (next.directionalAzimuth !== undefined) {
      lightAim.azimuth = next.directionalAzimuth;
    }
    if (next.directionalElevation !== undefined) {
      lightAim.elevation = next.directionalElevation;
    }
    if (next.ambientColor !== undefined) {
      ambient.color.set(next.ambientColor);
    }
    if (next.ambientIntensity !== undefined) {
      ambient.intensity = next.ambientIntensity;
    }
    directional.visible = directionalEnabled;
    if (next.directionalEnabled !== undefined) {
      applyShadowState();
    }
    if (next.directionalAzimuth !== undefined || next.directionalElevation !== undefined) {
      fitShadowCamera(current);
    }
    return getLights();
  }

  function matchLightToCamera(): ViewerLights {
    const offset = camera.position.clone().sub(controls.target);
    const len = offset.length();
    if (len < 1e-6) {
      return getLights();
    }
    let azimuth = (Math.atan2(offset.x, offset.z) * 180) / Math.PI;
    if (azimuth < 0) {
      azimuth += 360;
    }
    const elevation = THREE.MathUtils.clamp((Math.asin(offset.y / len) * 180) / Math.PI, 5, 85);
    return setLights({
      directionalAzimuth: azimuth,
      directionalElevation: elevation,
    });
  }

  function applyModelShadowFlags(root: THREE.Object3D | null): void {
    if (!root) {
      return;
    }
    root.traverse((obj) => {
      if (obj.userData[STENCIL_HELPER] === true) {
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = shadowOpts.modelCast;
      mesh.receiveShadow = shadowOpts.modelReceive;
    });
  }

  function fitShadowCamera(root: THREE.Object3D | null): void {
    const box = root
      ? new THREE.Box3().setFromObject(root)
      : new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1.6, 0.5));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.4) * 0.7;
    const az = (lightAim.azimuth * Math.PI) / 180;
    const el = (lightAim.elevation * Math.PI) / 180;
    const dist = radius * 3;
    directional.target.position.copy(center);
    directional.position.set(
      center.x + Math.sin(az) * Math.cos(el) * dist,
      center.y + Math.sin(el) * dist,
      center.z + Math.cos(az) * Math.cos(el) * dist,
    );
    const cam = directional.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.2;
    cam.far = radius * 8;
    cam.updateProjectionMatrix();
    if (Number.isFinite(box.min.y)) {
      ground.position.y = box.min.y;
    }
  }

  function applyShadowState(): void {
    renderer.shadowMap.enabled = shadowOpts.enabled;
    directional.castShadow = shadowOpts.enabled && directionalEnabled;
    directional.shadow.intensity = shadowOpts.intensity;
    directional.shadow.bias = shadowOpts.bias;
    directional.shadow.normalBias = shadowOpts.normalBias;
    const map = shadowOpts.mapSize;
    if (directional.shadow.mapSize.x !== map) {
      directional.shadow.mapSize.set(map, map);
      directional.shadow.map?.dispose();
      directional.shadow.map = null;
    }
    ground.visible = shadowOpts.enabled && shadowOpts.ground;
    ground.receiveShadow = shadowOpts.ground;
    applyModelShadowFlags(current);
  }

  function getShadows(): ViewerShadows {
    return { ...shadowOpts };
  }

  function setShadows(next: Partial<ViewerShadows>): ViewerShadows {
    shadowOpts = { ...shadowOpts, ...next };
    applyShadowState();
    return getShadows();
  }

  applyShadowState();
  fitShadowCamera(null);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  function resize(): void {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    vrmUpdate?.(delta);
    spriteParticles?.update(delta, camera);
    if (viewHelper.animating) {
      viewHelper.update(delta);
      if (!viewHelper.animating) {
        controls.enabled = true;
      }
    } else {
      controls.update();
    }
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    viewHelper.render(renderer);
    renderer.autoClear = true;
  });

  async function yieldPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  async function parseAndShow(
    bytes: ArrayBuffer,
    name: string,
    frameCamera: boolean,
    attachXt: boolean,
    onStage?: (stage: ViewerLoadStage) => void,
  ): Promise<{ status: ViewerStatus; gen: number }> {
    const gen = ++loadGen;
    onStage?.('parsing');
    await yieldPaint();
    const gltf = await loader.parseAsync(bytes, '');
    if (gen !== loadGen) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error('Load superseded');
    }
    if (attachXt) {
      onStage?.('applying');
      await yieldPaint();
      await tryAttach(gltf);
    }
    if (gen !== loadGen) {
      VRMUtils.deepDispose(gltf.scene);
      throw new Error('Load superseded');
    }

    const vrm = gltf.userData.vrm as VrmInstance | undefined;
    const root = vrm?.scene ?? gltf.scene;
    if (vrm) {
      VRMUtils.rotateVRM0(vrm as never);
    }

    const old = current;
    const oldGltf = currentGltf;
    const oldParticles = spriteParticles;
    scene.add(root);
    current = root;
    currentGltf = gltf;
    vrmUpdate = (delta) => {
      if (vrm) {
        vrm.update(delta);
        return;
      }
      const sidecar = gltf.userData.mtoonSidecar as { materials?: { update: (d: number) => void }[] } | undefined;
      for (const mat of sidecar?.materials ?? []) {
        mat.update(delta);
      }
    };
    const xt = gltf.userData.vrmxt as VrmxtAttachResult | undefined;
    spriteParticles = xt?.spriteParticles ?? null;
    applyModelShadowFlags(root);

    if (old) {
      oldParticles?.dispose();
      if (oldGltf) {
        resetMtoonxtStencil(oldGltf);
      }
      scene.remove(old);
      VRMUtils.deepDispose(old);
    }

    if (frameCamera) {
      frameObject(root);
    }
    fitShadowCamera(root);

    return {
      gen,
      status: {
        name,
        vrmxtEnabled: attachXt,
        mtoonxtApplied: xt?.mtoonxtApplied ?? 0,
        mtoonxtSkipped: xt?.mtoonxtSkipped ?? 0,
        spriteParticleApplied: xt?.spriteParticleApplied ?? 0,
        spriteParticleSkipped: xt?.spriteParticleSkipped ?? 0,
      },
    };
  }

  function commitIfCurrent(gen: number): void {
    if (gen !== loadGen) {
      throw new Error('Load superseded');
    }
  }

  async function loadBytes(
    bytes: ArrayBuffer,
    name: string,
    opts?: ViewerLoadOptions,
  ): Promise<ViewerStatus> {
    const copy = bytes.slice(0);
    const { status, gen } = await parseAndShow(
      copy,
      name,
      true,
      vrmxtEnabled,
      opts?.onStage,
    );
    commitIfCurrent(gen);
    lastSource = { bytes: copy, name };
    const parts = parseGlb(copy);
    glbBin = parts ? parts.bin : undefined;
    return status;
  }

  function getVrmxtEnabled(): boolean {
    return vrmxtEnabled;
  }

  async function setVrmxtEnabled(
    enabled: boolean,
    opts?: ViewerLoadOptions,
  ): Promise<ViewerStatus | null> {
    if (!lastSource) {
      vrmxtEnabled = enabled;
      return null;
    }
    const { status, gen } = await parseAndShow(
      lastSource.bytes,
      lastSource.name,
      false,
      enabled,
      opts?.onStage,
    );
    commitIfCurrent(gen);
    vrmxtEnabled = enabled;
    return status;
  }

  function attachStatus(name: string, attachXt: boolean, xt: VrmxtAttachResult | undefined): ViewerStatus {
    spriteParticles = xt?.spriteParticles ?? null;
    return {
      name,
      vrmxtEnabled: attachXt,
      mtoonxtApplied: xt?.mtoonxtApplied ?? 0,
      mtoonxtSkipped: xt?.mtoonxtSkipped ?? 0,
      spriteParticleApplied: xt?.spriteParticleApplied ?? 0,
      spriteParticleSkipped: xt?.spriteParticleSkipped ?? 0,
    };
  }

  function gltfJson(): GltfJson | null {
    if (!currentGltf) {
      return null;
    }
    return currentGltf.parser.json as GltfJson;
  }

  function syncSourceBytes(): void {
    if (!lastSource || !currentGltf || glbBin === undefined) {
      return;
    }
    lastSource.bytes = buildGlb(currentGltf.parser.json, glbBin);
  }

  function getStencils(): MtoonxtStencil[] {
    const json = gltfJson();
    if (!json) {
      return [];
    }
    return listStencils(json);
  }

  function getMtoonMaterials(): { index: number; name: string; hasMtoon: boolean }[] {
    const json = gltfJson();
    if (!json) {
      return [];
    }
    return listMtoonMaterials(json);
  }

  async function reapplyXt(name: string): Promise<ViewerStatus | null> {
    if (!currentGltf || !lastSource) {
      return null;
    }
    resetMtoonxtStencil(currentGltf);
    spriteParticles = null;
    let xt: VrmxtAttachResult | undefined;
    if (vrmxtEnabled) {
      xt = await tryAttach(currentGltf);
    } else {
      disposeSpriteParticles(currentGltf);
    }
    return attachStatus(name, vrmxtEnabled, xt);
  }

  async function setStencils(stencils: MtoonxtStencil[]): Promise<ViewerStatus | null> {
    const json = gltfJson();
    if (!json || !lastSource) {
      return null;
    }
    if (!writeGltfStencils(json, stencils)) {
      return null;
    }
    syncSourceBytes();
    return reapplyXt(lastSource.name);
  }

  function particleJson(): ParticleGltfJson | null {
    return gltfJson() as ParticleGltfJson | null;
  }

  function getGltfNodes(): GltfNodeOption[] {
    const json = particleJson();
    if (!json) {
      return [];
    }
    return listGltfNodes(json);
  }

  function getGltfTextures(): GltfTextureOption[] {
    const json = particleJson();
    if (!json) {
      return [];
    }
    return listGltfTextures(json);
  }

  function getSpriteParticleEmitters(): SpriteParticleRow[] {
    const json = particleJson();
    if (!json) {
      return [];
    }
    return listSpriteParticleEmitters(json);
  }

  async function applyParticleJson(): Promise<ViewerStatus | null> {
    if (!lastSource) {
      return null;
    }
    syncSourceBytes();
    return reapplyXt(lastSource.name);
  }

  async function patchSpriteParticleEmitter(
    index: number,
    patch: SpriteParticlePatch,
  ): Promise<ViewerStatus | null> {
    const json = particleJson();
    if (!json || !lastSource) {
      return null;
    }
    if (!setSpriteParticleEmitter(json, index, patch)) {
      return null;
    }
    return applyParticleJson();
  }

  async function addSpriteParticle(node?: number): Promise<ViewerStatus | null> {
    const json = particleJson();
    if (!json || !lastSource) {
      return null;
    }
    const attach = node ?? 0;
    if (addSpriteParticleEmitter(json, attach) === null) {
      return null;
    }
    return applyParticleJson();
  }

  async function removeSpriteParticle(index: number): Promise<ViewerStatus | null> {
    const json = particleJson();
    if (!json || !lastSource) {
      return null;
    }
    if (!removeSpriteParticleEmitter(json, index)) {
      return null;
    }
    return applyParticleJson();
  }

  async function packSpriteParticleTexture(
    emitterIndex: number,
    imageBytes: ArrayBuffer,
    fileName: string,
  ): Promise<ViewerStatus | null> {
    const live = particleJson();
    if (!live || !lastSource || glbBin === undefined) {
      return null;
    }
    const json = cloneJson(live);
    const data = new Uint8Array(imageBytes);
    const mime = sniffImageMime(data);
    if (!mime) {
      return null;
    }
    const label = fileName.replace(/\.[^.]+$/u, '').trim() || 'sprite';
    const packed = appendImageToGlbBin(json as GlbJsonForPack, glbBin, data, mime, label);
    if (!setSpriteParticleEmitter(json, emitterIndex, { texture: packed.textureIndex })) {
      return null;
    }
    const bytes = buildGlb(json, packed.bin);
    const { status, gen } = await parseAndShow(bytes, lastSource.name, false, vrmxtEnabled);
    commitIfCurrent(gen);
    lastSource = { bytes: bytes.slice(0), name: lastSource.name };
    const parts = parseGlb(lastSource.bytes);
    glbBin = parts ? parts.bin : undefined;
    return status;
  }

  function canExportGlb(): boolean {
    return lastSource !== null && currentGltf !== null && glbBin !== undefined;
  }

  function exportGlb(): ArrayBuffer | null {
    const json = gltfJson();
    if (!json || glbBin === undefined) {
      return null;
    }
    const copy = cloneJson(json);
    sanitizeMtoonxtStencils(copy);
    sanitizeSpriteParticles(copy as ParticleGltfJson);
    return buildGlb(copy, glbBin);
  }

  function getSourceName(): string | null {
    return lastSource?.name ?? null;
  }

  function dispose(): void {
    spriteParticles?.dispose();
    spriteParticles = null;
    if (currentGltf) {
      resetMtoonxtStencil(currentGltf);
    }
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    viewHelperHost.removeEventListener('pointerdown', onHelperPointerDown);
    viewHelperHost.removeEventListener('pointerup', onHelperPointerUp);
    viewHelperHost.removeEventListener('pointercancel', onHelperPointerCancel);
    viewHelperHost.removeEventListener('lostpointercapture', onHelperPointerCancel);
    viewHelperHost.remove();
    viewHelper.dispose();
    controls.dispose();
    renderer.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    loadBytes,
    getVrmxtEnabled,
    setVrmxtEnabled,
    getLights,
    setLights,
    matchLightToCamera,
    resetView,
    getShadows,
    setShadows,
    getStencils,
    getMtoonMaterials,
    setStencils,
    getGltfNodes,
    getGltfTextures,
    getSpriteParticleEmitters,
    setSpriteParticleEmitter: patchSpriteParticleEmitter,
    addSpriteParticleEmitter: addSpriteParticle,
    removeSpriteParticleEmitter: removeSpriteParticle,
    packSpriteParticleTexture,
    canExportGlb,
    exportGlb,
    getSourceName,
    dispose,
  };
}
