import {
  createVrmxtViewer,
  type MtoonxtStencil,
  type ViewerLoadStage,
  type ViewerShadows,
  type ViewerStatus,
} from '@vrmxt/viewer-core';

const canvas = document.querySelector('#view') as HTMLCanvasElement;
const statusEl = document.querySelector('#status') as HTMLElement;
const loadEl = document.querySelector('#load') as HTMLElement;
const loadBarEl = document.querySelector('#load-bar') as HTMLProgressElement;
const loadLabelEl = document.querySelector('#load-label') as HTMLElement;
const fileEl = document.querySelector('#file') as HTMLInputElement;
const vrmxtEnabledEl = document.querySelector('#vrmxt-enabled') as HTMLInputElement;
const dirColorEl = document.querySelector('#dir-color') as HTMLInputElement;
const dirEnabledEl = document.querySelector('#dir-enabled') as HTMLInputElement;
const dirFieldsEl = document.querySelector('#dir-fields') as HTMLFieldSetElement;
const dirIntEl = document.querySelector('#dir-int') as HTMLInputElement;
const dirIntValEl = document.querySelector('#dir-int-val') as HTMLElement;
const dirAzEl = document.querySelector('#dir-az') as HTMLInputElement;
const dirAzValEl = document.querySelector('#dir-az-val') as HTMLElement;
const dirElEl = document.querySelector('#dir-el') as HTMLInputElement;
const dirElValEl = document.querySelector('#dir-el-val') as HTMLElement;
const dirMatchEl = document.querySelector('#dir-match') as HTMLButtonElement;
const ambColorEl = document.querySelector('#amb-color') as HTMLInputElement;
const ambIntEl = document.querySelector('#amb-int') as HTMLInputElement;
const ambIntValEl = document.querySelector('#amb-int-val') as HTMLElement;
const shEnabledEl = document.querySelector('#sh-enabled') as HTMLInputElement;
const shFieldsEl = document.querySelector('#sh-fields') as HTMLFieldSetElement;
const shCastEl = document.querySelector('#sh-cast') as HTMLInputElement;
const shReceiveEl = document.querySelector('#sh-receive') as HTMLInputElement;
const shGroundEl = document.querySelector('#sh-ground') as HTMLInputElement;
const shIntEl = document.querySelector('#sh-int') as HTMLInputElement;
const shIntValEl = document.querySelector('#sh-int-val') as HTMLElement;
const shBiasEl = document.querySelector('#sh-bias') as HTMLInputElement;
const shBiasValEl = document.querySelector('#sh-bias-val') as HTMLElement;
const shNbiasEl = document.querySelector('#sh-nbias') as HTMLInputElement;
const shNbiasValEl = document.querySelector('#sh-nbias-val') as HTMLElement;
const shMapEl = document.querySelector('#sh-map') as HTMLSelectElement;
const stencilRootEl = document.querySelector('#stencil-root') as HTMLElement;
const stencilAddEl = document.querySelector('#stencil-add') as HTMLButtonElement;
const particleRootEl = document.querySelector('#particle-root') as HTMLElement;
const particleAddEl = document.querySelector('#particle-add') as HTMLButtonElement;
const downloadEl = document.querySelector('#download') as HTMLButtonElement;
const viewResetEl = document.querySelector('#view-reset') as HTMLButtonElement;
const viewer = createVrmxtViewer(canvas);

function isSuperseded(err: unknown): boolean {
  return err instanceof Error && err.message === 'Load superseded';
}

function formatStatus(info: ViewerStatus): string {
  if (!info.vrmxtEnabled) {
    return `${info.name}  VRMXT off`;
  }
  return `${info.name}  MToonXT applied=${info.mtoonxtApplied} skipped=${info.mtoonxtSkipped}  particles applied=${info.spriteParticleApplied} skipped=${info.spriteParticleSkipped}`;
}

function stageLabel(stage: 'reading' | ViewerLoadStage): string {
  if (stage === 'reading') {
    return 'Reading file…';
  }
  if (stage === 'parsing') {
    return 'Parsing VRM…';
  }
  return 'Applying VRMXT…';
}

async function yieldPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

let loadUiGen = 0;

function showLoad(stepCount: number): number {
  const gen = ++loadUiGen;
  loadBarEl.max = stepCount;
  loadBarEl.value = 0;
  loadEl.classList.add('is-on');
  statusEl.hidden = true;
  return gen;
}

function setLoadStage(gen: number, stage: 'reading' | ViewerLoadStage, step: number): void {
  if (gen !== loadUiGen) {
    return;
  }
  loadBarEl.value = step;
  loadLabelEl.textContent = stageLabel(stage);
}

function hideLoad(gen: number): void {
  if (gen !== loadUiGen) {
    return;
  }
  loadEl.classList.remove('is-on');
  statusEl.hidden = false;
}

function formatIntensity(value: number): string {
  return value.toFixed(2);
}

function formatDegrees(value: number): string {
  return `${Math.round(value)}°`;
}

function formatBias(value: number): string {
  return value.toFixed(4);
}

function syncLightUi(): void {
  const lights = viewer.getLights();
  dirEnabledEl.checked = lights.directionalEnabled;
  dirFieldsEl.disabled = !lights.directionalEnabled;
  dirColorEl.value = lights.directionalColor;
  dirIntEl.value = String(lights.directionalIntensity);
  dirIntValEl.textContent = formatIntensity(lights.directionalIntensity);
  dirAzEl.value = String(lights.directionalAzimuth);
  dirAzValEl.textContent = formatDegrees(lights.directionalAzimuth);
  dirElEl.value = String(lights.directionalElevation);
  dirElValEl.textContent = formatDegrees(lights.directionalElevation);
  ambColorEl.value = lights.ambientColor;
  ambIntEl.value = String(lights.ambientIntensity);
  ambIntValEl.textContent = formatIntensity(lights.ambientIntensity);

  const shadows = viewer.getShadows();
  shEnabledEl.checked = shadows.enabled;
  shFieldsEl.disabled = !shadows.enabled;
  shCastEl.checked = shadows.modelCast;
  shReceiveEl.checked = shadows.modelReceive;
  shGroundEl.checked = shadows.ground;
  shIntEl.value = String(shadows.intensity);
  shIntValEl.textContent = formatIntensity(shadows.intensity);
  shBiasEl.value = String(shadows.bias);
  shBiasValEl.textContent = formatBias(shadows.bias);
  shNbiasEl.value = String(shadows.normalBias);
  shNbiasValEl.textContent = formatIntensity(shadows.normalBias);
  shMapEl.value = String(shadows.mapSize);
}

dirEnabledEl.addEventListener('change', () => {
  viewer.setLights({ directionalEnabled: dirEnabledEl.checked });
  dirFieldsEl.disabled = !dirEnabledEl.checked;
});
dirColorEl.addEventListener('input', () => {
  viewer.setLights({ directionalColor: dirColorEl.value });
});
dirIntEl.addEventListener('input', () => {
  const directionalIntensity = Number(dirIntEl.value);
  viewer.setLights({ directionalIntensity });
  dirIntValEl.textContent = formatIntensity(directionalIntensity);
});
dirAzEl.addEventListener('input', () => {
  const directionalAzimuth = Number(dirAzEl.value);
  viewer.setLights({ directionalAzimuth });
  dirAzValEl.textContent = formatDegrees(directionalAzimuth);
});
dirElEl.addEventListener('input', () => {
  const directionalElevation = Number(dirElEl.value);
  viewer.setLights({ directionalElevation });
  dirElValEl.textContent = formatDegrees(directionalElevation);
});
dirMatchEl.addEventListener('click', () => {
  viewer.matchLightToCamera();
  syncLightUi();
});
viewResetEl.addEventListener('click', () => {
  viewer.resetView();
});
ambColorEl.addEventListener('input', () => {
  viewer.setLights({ ambientColor: ambColorEl.value });
});
ambIntEl.addEventListener('input', () => {
  const ambientIntensity = Number(ambIntEl.value);
  viewer.setLights({ ambientIntensity });
  ambIntValEl.textContent = formatIntensity(ambientIntensity);
});

shEnabledEl.addEventListener('change', () => {
  viewer.setShadows({ enabled: shEnabledEl.checked });
  shFieldsEl.disabled = !shEnabledEl.checked;
});
shCastEl.addEventListener('change', () => {
  viewer.setShadows({ modelCast: shCastEl.checked });
});
shReceiveEl.addEventListener('change', () => {
  viewer.setShadows({ modelReceive: shReceiveEl.checked });
});
shGroundEl.addEventListener('change', () => {
  viewer.setShadows({ ground: shGroundEl.checked });
});
shIntEl.addEventListener('input', () => {
  const intensity = Number(shIntEl.value);
  viewer.setShadows({ intensity });
  shIntValEl.textContent = formatIntensity(intensity);
});
shBiasEl.addEventListener('input', () => {
  const bias = Number(shBiasEl.value);
  viewer.setShadows({ bias });
  shBiasValEl.textContent = formatBias(bias);
});
shNbiasEl.addEventListener('input', () => {
  const normalBias = Number(shNbiasEl.value);
  viewer.setShadows({ normalBias });
  shNbiasValEl.textContent = formatIntensity(normalBias);
});
shMapEl.addEventListener('change', () => {
  const mapSize = Number(shMapEl.value) as ViewerShadows['mapSize'];
  viewer.setShadows({ mapSize });
});
syncLightUi();
vrmxtEnabledEl.checked = viewer.getVrmxtEnabled();

const DEPTH_TESTS = [
  'never',
  'less',
  'equal',
  'lessEqual',
  'greater',
  'notEqual',
  'greaterEqual',
  'always',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function depthOptions(current: string): string {
  return DEPTH_TESTS.map((value) => {
    const selected = value === current ? ' selected' : '';
    return `<option value="${value}"${selected}>${value}</option>`;
  }).join('');
}

function materialBoxes(
  role: 'writer' | 'reader',
  selected: number[],
  materials: { index: number; name: string; hasMtoon: boolean }[],
): string {
  const boxes = materials
    .filter((row) => row.hasMtoon)
    .map((row) => {
      const checked = selected.includes(row.index) ? ' checked' : '';
      return `<label class="check"><input type="checkbox" data-role="${role}" value="${row.index}"${checked} /> ${escapeHtml(row.name)}</label>`;
    })
    .join('');
  return `<div class="writers"><span>${role === 'writer' ? 'Writers' : 'Readers'}</span>${boxes || '<span class="muted">No MToon materials</span>'}</div>`;
}

function openStencilIndices(): Set<number> {
  const open = new Set<number>();
  stencilRootEl.querySelectorAll('details[data-stencil-index][open]').forEach((el) => {
    open.add(Number((el as HTMLElement).dataset.stencilIndex));
  });
  return open;
}

function defaultStencil(
  materials: { index: number; name: string; hasMtoon: boolean }[],
): MtoonxtStencil | null {
  const mtoon = materials.filter((row) => row.hasMtoon).map((row) => row.index);
  if (mtoon.length < 2) {
    return null;
  }
  return {
    writers: [mtoon[0]],
    readers: [mtoon[1]],
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
  };
}

function stencilFromDetails(details: HTMLDetailsElement): MtoonxtStencil {
  const writers = Array.from(details.querySelectorAll('[data-role="writer"]'))
    .filter((el) => (el as HTMLInputElement).checked)
    .map((el) => Number((el as HTMLInputElement).value));
  const readers = Array.from(details.querySelectorAll('[data-role="reader"]'))
    .filter((el) => (el as HTMLInputElement).checked)
    .map((el) => Number((el as HTMLInputElement).value));
  const comparison =
    (details.querySelector('[data-role="comparison"]') as HTMLSelectElement | null)?.value ===
    'inside'
      ? 'inside'
      : 'outside';
  const checked = (role: string) =>
    (details.querySelector(`[data-role="${role}"]`) as HTMLInputElement | null)?.checked === true;
  const selectVal = (role: string, fallback: string) =>
    (details.querySelector(`[data-role="${role}"]`) as HTMLSelectElement | null)?.value ?? fallback;
  return {
    writers,
    readers,
    comparison,
    showWritersThroughOccluders: checked('show-through'),
    writersOnlyInsideReaders: checked('inside-only'),
    writersOnlyOutsideReaders: checked('outside-only'),
    writersSelfOcclude: checked('self-occlude'),
    ignoreOccludedReaderAreas: checked('ignore-occluded'),
    writersWriteColor: checked('write-color'),
    writersWriteDepth: checked('write-depth'),
    readersWriteDepth: checked('readers-depth'),
    writerDepthTest: selectVal('writer-depth', 'lessEqual'),
    readerDepthTest: selectVal('reader-depth', 'lessEqual'),
  };
}

function exportFileName(name: string): string {
  return `${name.replace(/\.(vrm|glb|gltf)$/i, '')}-vrmxt.vrm`;
}

function syncDownload(): void {
  downloadEl.disabled = !viewer.canExportGlb();
}

function openParticleIndices(): Set<number> {
  const open = new Set<number>();
  particleRootEl.querySelectorAll('details[data-particle-index][open]').forEach((el) => {
    open.add(Number((el as HTMLElement).dataset.particleIndex));
  });
  return open;
}

function hexFromRgb(r: number, g: number, b: number): string {
  const byte = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function rgbFromHex(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  return [
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  ];
}

function nodeOptions(selected: number): string {
  return viewer
    .getGltfNodes()
    .map((node) => {
      const sel = node.index === selected ? ' selected' : '';
      return `<option value="${node.index}"${sel}>${escapeHtml(node.name)}</option>`;
    })
    .join('');
}

function textureOptions(selected: number | undefined): string {
  const none = selected === undefined ? ' selected' : '';
  const opts = [`<option value=""${none}>None</option>`];
  for (const tex of viewer.getGltfTextures()) {
    const sel = selected === tex.index ? ' selected' : '';
    opts.push(`<option value="${tex.index}"${sel}>${escapeHtml(tex.name)}</option>`);
  }
  return opts.join('');
}

function renderParticlePanel(): void {
  const rows = viewer.getSpriteParticleEmitters();
  syncDownload();
  particleAddEl.disabled = viewer.getGltfNodes().length === 0;
  if (rows.length === 0) {
    particleRootEl.innerHTML =
      '<span class="muted">No sprite particle emitters. Add one or load a VRM that has them.</span>';
    return;
  }
  const open = openParticleIndices();
  particleRootEl.innerHTML = rows
    .map((row) => {
      const isOpen = open.has(row.index) ? ' open' : '';
      const hex = hexFromRgb(row.color[0], row.color[1], row.color[2]);
      return `<details data-particle-index="${row.index}"${isOpen}>
        <summary>${escapeHtml(row.name ?? `Emitter ${row.index}`)}</summary>
        <div class="panel">
          <label>Name
            <input type="text" data-role="p-name" value="${escapeHtml(row.name ?? '')}" />
          </label>
          <label>Node
            <select data-role="p-node">${nodeOptions(row.node)}</select>
          </label>
          <label>Texture
            <select data-role="p-texture">${textureOptions(row.texture)}</select>
          </label>
          <label class="check">
            Pack image…
            <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden data-role="p-pack" />
          </label>
          <div class="row-2">
            <label>Width
              <input type="number" min="0.001" step="0.01" data-role="p-w" value="${row.size[0]}" />
            </label>
            <label>Height
              <input type="number" min="0.001" step="0.01" data-role="p-h" value="${row.size[1]}" />
            </label>
          </div>
          <label>Color
            <div class="light-row">
              <input type="color" data-role="p-color" value="${hex}" aria-label="Particle color" />
              <input type="range" min="0" max="1" step="0.05" data-role="p-alpha" value="${row.color[3]}" aria-label="Particle alpha" />
            </div>
          </label>
          <label>Emission rate
            <input type="number" min="0" step="0.5" data-role="p-rate" value="${row.emissionRate}" />
          </label>
          <label>Lifetime
            <input type="number" min="0" step="0.1" data-role="p-life" value="${row.lifetime}" />
          </label>
          <label>Start speed
            <input type="number" min="0" step="0.01" data-role="p-speed" value="${row.startSpeed}" />
          </label>
          <label>Max particles
            <input type="number" min="1" step="1" data-role="p-max" value="${row.maxParticles}" />
          </label>
          <button type="button" data-role="p-remove">Remove emitter</button>
        </div>
      </details>`;
    })
    .join('');
}

async function commitParticle(details: HTMLDetailsElement): Promise<void> {
  const index = Number(details.dataset.particleIndex);
  const name = (details.querySelector('[data-role="p-name"]') as HTMLInputElement | null)?.value;
  const node = Number(
    (details.querySelector('[data-role="p-node"]') as HTMLSelectElement | null)?.value,
  );
  const texRaw = (details.querySelector('[data-role="p-texture"]') as HTMLSelectElement | null)
    ?.value;
  const w = Number((details.querySelector('[data-role="p-w"]') as HTMLInputElement | null)?.value);
  const h = Number((details.querySelector('[data-role="p-h"]') as HTMLInputElement | null)?.value);
  const hex = (details.querySelector('[data-role="p-color"]') as HTMLInputElement | null)?.value;
  const alpha = Number(
    (details.querySelector('[data-role="p-alpha"]') as HTMLInputElement | null)?.value,
  );
  const emissionRate = Number(
    (details.querySelector('[data-role="p-rate"]') as HTMLInputElement | null)?.value,
  );
  const lifetime = Number(
    (details.querySelector('[data-role="p-life"]') as HTMLInputElement | null)?.value,
  );
  const startSpeed = Number(
    (details.querySelector('[data-role="p-speed"]') as HTMLInputElement | null)?.value,
  );
  const maxParticles = Number(
    (details.querySelector('[data-role="p-max"]') as HTMLInputElement | null)?.value,
  );
  if (!hex || !Number.isFinite(node)) {
    return;
  }
  const [r, g, b] = rgbFromHex(hex);
  const texture = texRaw === '' || texRaw === undefined ? null : Number(texRaw);
  const info = await viewer.setSpriteParticleEmitter(index, {
    name: name ?? '',
    node,
    texture,
    size: [w, h],
    color: [r, g, b, alpha],
    emissionRate,
    lifetime,
    startSpeed,
    maxParticles,
  });
  if (info) {
    applyStatus(info);
  } else {
    renderParticlePanel();
  }
}

function defaultParticleNode(): number {
  const nodes = viewer.getGltfNodes();
  const hips = nodes.find((n) => n.name.toLowerCase() === 'hips');
  return hips?.index ?? nodes[0]?.index ?? 0;
}

function renderStencilPanel(): void {
  const materials = viewer.getMtoonMaterials();
  const rows = viewer.getStencils();
  syncDownload();
  const canAdd = materials.filter((row) => row.hasMtoon).length >= 2;
  stencilAddEl.disabled = viewer.getSourceName() === null || !canAdd;
  if (viewer.getSourceName() === null) {
    stencilRootEl.innerHTML = '<span class="muted">Load a VRM to edit stencil.</span>';
    return;
  }
  if (rows.length === 0) {
    stencilRootEl.innerHTML = '<span class="muted">No stencils. Add one to author the root graph.</span>';
    return;
  }
  const open = openStencilIndices();
  stencilRootEl.innerHTML = rows
    .map((row, index) => {
      const isOpen = open.has(index) ? ' open' : '';
      const insideSel = row.comparison === 'inside' ? ' selected' : '';
      const outsideSel = row.comparison === 'outside' ? ' selected' : '';
      const check = (on: boolean) => (on ? ' checked' : '');
      return `<details data-stencil-index="${index}"${isOpen}>
        <summary>Stencil ${index + 1}</summary>
        <div class="panel">
          ${materialBoxes('writer', row.writers, materials)}
          ${materialBoxes('reader', row.readers, materials)}
          <label>Comparison
            <select data-role="comparison">
              <option value="inside"${insideSel}>Inside</option>
              <option value="outside"${outsideSel}>Outside</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" data-role="show-through"${check(row.showWritersThroughOccluders)} /> Show writers through occluders</label>
          <label class="check"><input type="checkbox" data-role="inside-only"${check(row.writersOnlyInsideReaders)} /> Writers only inside readers</label>
          <label class="check"><input type="checkbox" data-role="outside-only"${check(row.writersOnlyOutsideReaders)} /> Writers only outside readers</label>
          <label class="check"><input type="checkbox" data-role="self-occlude"${check(row.writersSelfOcclude)} /> Writers self occlude</label>
          <label class="check"><input type="checkbox" data-role="ignore-occluded"${check(row.ignoreOccludedReaderAreas)} /> Ignore occluded reader areas</label>
          <label class="check"><input type="checkbox" data-role="write-color"${check(row.writersWriteColor)} /> Writers write color</label>
          <label class="check"><input type="checkbox" data-role="write-depth"${check(row.writersWriteDepth)} /> Writers write depth</label>
          <label class="check"><input type="checkbox" data-role="readers-depth"${check(row.readersWriteDepth)} /> Readers write depth</label>
          <label>Writer depth test
            <select data-role="writer-depth">${depthOptions(row.writerDepthTest)}</select>
          </label>
          <label>Reader depth test
            <select data-role="reader-depth">${depthOptions(row.readerDepthTest)}</select>
          </label>
          <button type="button" data-role="s-remove">Remove stencil</button>
        </div>
      </details>`;
    })
    .join('');
}

async function commitStencils(): Promise<void> {
  const next = Array.from(stencilRootEl.querySelectorAll('details[data-stencil-index]')).map(
    (el) => stencilFromDetails(el as HTMLDetailsElement),
  );
  const info = await viewer.setStencils(next);
  if (info) {
    applyStatus(info);
  } else {
    renderStencilPanel();
  }
}

function applyStatus(info: ViewerStatus): void {
  vrmxtEnabledEl.checked = info.vrmxtEnabled;
  statusEl.textContent = formatStatus(info);
  renderStencilPanel();
  renderParticlePanel();
}

vrmxtEnabledEl.addEventListener('change', () => {
  void (async () => {
    const enabled = vrmxtEnabledEl.checked;
    const steps = enabled ? 2 : 1;
    const uiGen = showLoad(steps);
    setLoadStage(uiGen, 'parsing', 1);
    await yieldPaint();
    try {
      const info = await viewer.setVrmxtEnabled(enabled, {
        onStage: (stage) => {
          setLoadStage(uiGen, stage, stage === 'parsing' ? 1 : 2);
        },
      });
      hideLoad(uiGen);
      if (info) {
        applyStatus(info);
      } else {
        vrmxtEnabledEl.checked = viewer.getVrmxtEnabled();
        statusEl.textContent = viewer.getVrmxtEnabled()
          ? 'Drop a .vrm here or open a file.'
          : 'VRMXT off. Drop a .vrm here or open a file.';
      }
    } catch (err) {
      hideLoad(uiGen);
      vrmxtEnabledEl.checked = viewer.getVrmxtEnabled();
      if (isSuperseded(err)) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      statusEl.textContent = `Load failed: ${message}`;
    }
  })();
});

const DEFAULT_VRM_URL = `${import.meta.env.BASE_URL}stencil-cube.vrm`;
const DEFAULT_VRM_NAME = 'stencil-cube.vrm';

async function loadBytesNamed(bytes: ArrayBuffer, name: string): Promise<void> {
  const applyXt = viewer.getVrmxtEnabled();
  const steps = applyXt ? 3 : 2;
  const uiGen = showLoad(steps);
  setLoadStage(uiGen, 'reading', 1);
  await yieldPaint();
  try {
    const info = await viewer.loadBytes(bytes, name, {
      onStage: (stage) => {
        setLoadStage(uiGen, stage, stage === 'parsing' ? 2 : 3);
      },
    });
    hideLoad(uiGen);
    applyStatus(info);
  } catch (err) {
    hideLoad(uiGen);
    vrmxtEnabledEl.checked = viewer.getVrmxtEnabled();
    if (isSuperseded(err)) {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Load failed: ${message}`;
  }
}

async function loadFile(file: File): Promise<void> {
  await loadBytesNamed(await file.arrayBuffer(), file.name);
}

async function loadDefaultVrm(): Promise<void> {
  try {
    const res = await fetch(DEFAULT_VRM_URL);
    if (!res.ok) {
      throw new Error(`Default VRM HTTP ${res.status}`);
    }
    await loadBytesNamed(await res.arrayBuffer(), DEFAULT_VRM_NAME);
  } catch (err) {
    if (isSuperseded(err)) {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    statusEl.textContent = `Load failed: ${message}`;
  }
}

fileEl.addEventListener('change', () => {
  const file = fileEl.files?.[0];
  if (file) {
    void loadFile(file);
  }
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) {
    void loadFile(file);
  }
});

stencilRootEl.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  const details = target.closest('details[data-stencil-index]') as HTMLDetailsElement | null;
  if (!details) {
    return;
  }
  if (target.dataset.role === 'inside-only' && target.checked) {
    const other = details.querySelector('[data-role="outside-only"]') as HTMLInputElement | null;
    if (other) {
      other.checked = false;
    }
  }
  if (target.dataset.role === 'outside-only' && target.checked) {
    const other = details.querySelector('[data-role="inside-only"]') as HTMLInputElement | null;
    if (other) {
      other.checked = false;
    }
  }
  if (target.dataset.role === 'writer' && target.checked) {
    const reader = details.querySelector(
      `[data-role="reader"][value="${target.value}"]`,
    ) as HTMLInputElement | null;
    if (reader) {
      reader.checked = false;
    }
  }
  if (target.dataset.role === 'reader' && target.checked) {
    const writer = details.querySelector(
      `[data-role="writer"][value="${target.value}"]`,
    ) as HTMLInputElement | null;
    if (writer) {
      writer.checked = false;
    }
  }
  void commitStencils();
});

stencilRootEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.dataset.role !== 's-remove') {
    return;
  }
  const details = target.closest('details[data-stencil-index]') as HTMLDetailsElement | null;
  if (!details) {
    return;
  }
  const index = Number(details.dataset.stencilIndex);
  const next = viewer.getStencils().filter((_, i) => i !== index);
  void (async () => {
    const info = await viewer.setStencils(next);
    if (info) {
      applyStatus(info);
    } else {
      renderStencilPanel();
    }
  })();
});

stencilAddEl.addEventListener('click', () => {
  const created = defaultStencil(viewer.getMtoonMaterials());
  if (!created) {
    return;
  }
  void (async () => {
    const info = await viewer.setStencils([...viewer.getStencils(), created]);
    if (info) {
      applyStatus(info);
    }
  })();
});

particleRootEl.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  const details = target.closest('details[data-particle-index]') as HTMLDetailsElement | null;
  if (!details) {
    return;
  }
  if (target.dataset.role === 'p-pack') {
    const file = target.files?.[0];
    target.value = '';
    if (!file) {
      return;
    }
    const index = Number(details.dataset.particleIndex);
    void (async () => {
      const info = await viewer.packSpriteParticleTexture(index, await file.arrayBuffer(), file.name);
      if (info) {
        applyStatus(info);
      } else {
        statusEl.textContent = 'Pack failed. Use a PNG or JPEG.';
        renderParticlePanel();
      }
    })();
    return;
  }
  void commitParticle(details);
});

particleRootEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.dataset.role !== 'p-remove') {
    return;
  }
  const details = target.closest('details[data-particle-index]') as HTMLDetailsElement | null;
  if (!details) {
    return;
  }
  const index = Number(details.dataset.particleIndex);
  void (async () => {
    const info = await viewer.removeSpriteParticleEmitter(index);
    if (info) {
      applyStatus(info);
    } else {
      renderParticlePanel();
    }
  })();
});

particleAddEl.addEventListener('click', () => {
  void (async () => {
    const info = await viewer.addSpriteParticleEmitter(defaultParticleNode());
    if (info) {
      applyStatus(info);
    }
  })();
});

downloadEl.addEventListener('click', () => {
  const bytes = viewer.exportGlb();
  const name = viewer.getSourceName();
  if (!bytes || !name) {
    return;
  }
  const blob = new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(name);
  a.click();
  URL.revokeObjectURL(url);
});

renderStencilPanel();
renderParticlePanel();
void loadDefaultVrm();
