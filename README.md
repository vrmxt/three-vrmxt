# three-vrmxt

Public repo: [vrmxt/three-vrmxt](https://github.com/vrmxt/three-vrmxt).

Not a fork of [@pixiv/three-vrm](https://github.com/pixiv/three-vrm). Not pixiv “hooks.”
This workspace ships an optional **peer** `GLTFLoader` plugin plus a first-party local-file viewer.

| Path | Role | npm |
|------|------|-----|
| `packages/three-vrmxt` | VRMXT / MToonXT attach beside `VRMLoaderPlugin` | `@vrmxt/three-vrmxt` (publishable) |
| `packages/viewer-core` | Canvas, orbit, load-from-bytes | not published |
| `apps/viewer` | Vite host: file picker, drag-drop, MToonXT stencil + sprite particle inspector, Download VRM. Live: [GitHub Pages](https://vrmxt.github.io/three-vrmxt/) | not published |

## Consumers

```bash
npm install @vrmxt/three-vrmxt
```

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

Hosted build: `https://vrmxt.github.io/three-vrmxt/` (Actions on `main`). Local `dev` stays at `/`. Pages build sets `GITHUB_PAGES=1` so Vite `base` is `/three-vrmxt/`.

First enable: repo **Settings → Pages → Source: GitHub Actions**.

Viewer boots with `apps/viewer/public/stencil-cube.vrm`: inner shapes write
only inside the matching cube faces (Sphere → FrontBack / Y, Cone → LeftRight
/ X, Torus → TopBottom / Z; inside overlay) plus `VRMXT_sprite_particle`
emitters on hips, head, and hands. Drop another `.vrm` to replace it.

Hub browser extension is still planned. `apps/viewer` edits and exports the root
MToonXT stencil graph (JSON patch). Sprite particles play on load; authoring stays in Blender.

## Specs

[Extended-VRM-Specs](https://github.com/vrmxt/Extended-VRM-Specs) — `implementations/three-vrmxt.md`.

## Publish `@vrmxt/three-vrmxt`

Only `packages/three-vrmxt` is public. `@vrmxt/viewer-core` and `@vrmxt/viewer-app` stay `private`.

npm scope `@vrmxt` is a separate org from GitHub `vrmxt`. npm Trusted Publishing cannot create a package that does not exist yet, so skip CI write tokens (the “use Trusted Publishing instead” warning). First version is a one-time local publish with your 2FA prompt. Later versions use GitHub Actions OIDC.

1. Create the npm org [vrmxt](https://www.npmjs.com/org/create) (2FA on). Join it as yourself.
2. `npm login` on this machine. From the repo root: `pnpm --filter @vrmxt/three-vrmxt publish --access public`. Enter the OTP. Do not pass `--provenance` here (that needs CI).
3. On [the new package](https://www.npmjs.com/package/@vrmxt/three-vrmxt) → Settings → Trusted Publisher → GitHub Actions:
   - Organization or user: `vrmxt`
   - Repository: `three-vrmxt`
   - Workflow filename: `publish.yml` (filename only)
   - Allowed actions: `npm publish`
4. Push this repo to `vrmxt/three-vrmxt` (local `origin` may still be `miramocha`). Later releases: GitHub Release or workflow **Publish @vrmxt/three-vrmxt**. No `NPM_TOKEN` secret.
5. After a CI publish works: package Settings → Publishing access → require 2FA and disallow tokens.

If the npm org name is taken, rename the package to `@miramocha/three-vrmxt` before the first publish.
