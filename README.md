# three-vrmxt

Public repo: [miramocha/three-vrmxt](https://github.com/miramocha/three-vrmxt).

Not a fork of [@pixiv/three-vrm](https://github.com/pixiv/three-vrm). Not pixiv “hooks.”
This workspace ships an optional **peer** `GLTFLoader` plugin plus a first-party local-file viewer.

| Path | Role | npm |
|------|------|-----|
| `packages/three-vrmxt` | VRMXT / MToonXT attach beside `VRMLoaderPlugin` | `@vrmxt/three-vrmxt` (publishable) |
| `packages/viewer-core` | Canvas, orbit, load-from-bytes | not published |
| `apps/viewer` | Vite host: file picker, drag-drop, MToonXT stencil + sprite particle inspector, Download VRM. Live: [GitHub Pages](https://miramocha.github.io/three-vrmxt/) | not published |

## Consumers

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMXTLoaderPlugin } from '@vrmxt/three-vrmxt';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.register((parser) => new VRMXTLoaderPlugin(parser));
```

Peers: `three`, `@pixiv/three-vrm`. Missing `VRMXT_*` leaves stock VRM load intact.

Construct `WebGLRenderer` with `stencil: true` so MToonXT coverage clip can run.
Setting `renderer.stencil` after construct does not allocate the buffer (Three.js r163+).

## Develop

```bash
pnpm install
pnpm --filter @vrmxt/viewer-app dev
```

Hosted build: `https://miramocha.github.io/three-vrmxt/` (Actions on `main`). Local `dev` stays at `/`. Pages build sets `GITHUB_PAGES=1` so Vite `base` is `/three-vrmxt/`.

First enable: repo **Settings → Pages → Source: GitHub Actions**.

Viewer boots with `apps/viewer/public/stencil-cube.vrm`: cube face writers
(Y front/back → sphere, X left/right → cone, Z top/bottom → torus) plus
`VRMXT_sprite_particle` emitters on hips, head, and hands. Drop another `.vrm`
to replace it. Nested ops on that sample are not read; add a root
`extensions.VRMXT_materials_mtoonxt.stencil[]` graph in the viewer and re-export
if you want GPU coverage clip from the sample.

Hub browser extension is still planned. `apps/viewer` edits and exports the root
MToonXT stencil graph (JSON patch). Sprite particles play on load; authoring stays in Blender.

## Specs

[Extended-VRM-Specs](https://github.com/miramocha/Extended-VRM-Specs) — `implementations/three-vrmxt.md`.
