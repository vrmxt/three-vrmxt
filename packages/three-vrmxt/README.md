# `@vrmxt/three-vrmxt`

Optional Extended VRM attach for apps that already use `@pixiv/three-vrm`.

This package is **not** a pixiv/three-vrm fork and does not add hooks inside
`VRMLoaderPlugin`. Register a second `GLTFLoader` plugin (Three.js loader API).

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMXTLoaderPlugin } from '@vrmxt/three-vrmxt';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
loader.register((parser) => new VRMXTLoaderPlugin(parser));
```

After load you can also call `tryAttach(gltf)` if the plugin was omitted.

Construct `WebGLRenderer` with `stencil: true` for `VRMXT_materials_mtoonxt` coverage
clip. Setting `renderer.stencil` after construct does not allocate the buffer
(Three.js r163+).

v1 applies body/outline stencil extras and `VRMXT_sprite_particle` (instanced
camera-facing quads). `apps/viewer` can edit stencil extras and download a GLB.
Face SDF is later.

## Non-humanoid GLB + MToon sidecar

Do **not** use `VRMLoaderPlugin` for props. Pair Blender skill `gltf-mtoon-sidecar`
(`mtoon.json`) with:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyMtoonSidecar } from '@vrmxt/three-vrmxt';

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('prop.glb');
const sidecar = await (await fetch('mtoon.json')).json();
applyMtoonSidecar(gltf, sidecar);
```

Peers: `three`, `@pixiv/three-vrm` (pulls `@pixiv/three-vrm-materials-mtoon`).
