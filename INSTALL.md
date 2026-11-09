# CALLORIA v3.0 — Real 3D Reception Lobby

## What this adds

This stage places a complete, real GLB lobby scene into the front-left reception zone of the existing CALLORIA Three.js world. It replaces the primitive reception counter, check-in screen, access posts, waiting seats/readers and the earlier individual reception-desk GLB only after the new lobby model loads and passes runtime checks. If it fails, the existing reception remains visible.

The scene includes a curved reception desk, panelled back wall, visitor seating, speedgates, lift core, sign-in kiosk and lobby props. Published asset metadata reports approximately 1.30 MB, 32,204 triangles, 99 source meshes, 7 materials and no textures. It is static geometry with no rig or animation clips. Compatible meshes are grouped by material/attribute layout to reduce draw calls; if a safe merge is not possible, the original authored scene is retained.

The model is scaled to 80% and placed at the front-left reception footprint to avoid the nearest workstation row and perimeter columns. It does not replace the rest of the office architecture.

## Install

Merge the ZIP into the root of `zaksz1991/calloria`.

**Replace this file completely:**
- `vite.config.js`

**Add these files:**
- `build/calloria-cc0-office-lobby-plugin.mjs`
- `js/cc0-office-lobby-integration.js`
- `tests/calloria-cc0-office-lobby.test.mjs`

Do not replace `package.json`, `main.js`, `production-world.js`, `glb-office-world-integration.js`, Supabase files or any existing GLB models. The replacement Vite config is copied from the current `main` branch and adds the new plugin after the existing GLB-first and workstation transforms.

The lobby loads asynchronously after the existing world begins initializing. It does not hold the player at a loading screen while the extra asset downloads. The status label initially shows `LOBBY: LOADING`, then changes to `LOBBY: CC0 GLB` after a successful load or `LOBBY: FALLBACK` if the existing reception must remain. The browser also emits `calloria:glb-lobby-ready` with the final status. If the world is disposed while the download is in progress, the late model is discarded.

## Asset delivery and licence

The lobby GLB is served from the publisher's permanent CORS-enabled CDN:

`https://cdn.3dassets.dev/assets/26326/v1/model.glb`

Source pack: `https://3dassets.dev/packs/office-lobby-and-facilities`

Licence: CC0 1.0 Universal. The source page states that commercial use, modification and redistribution are permitted without attribution. The model is authored in metres with +Y up and requires no Draco, Meshopt or KTX2 decoder. The source metadata lists `KHR_mesh_quantization`, which Three.js GLTFLoader supports.

This release loads the model from the CDN at runtime; it does not copy the binary into your GitHub repository. The first successful load transfers approximately 1.3 MB, subject to browser/CDN caching. A working internet connection is required for the new lobby; the game still retains the existing reception if the CDN cannot be reached.

## What remains unchanged

- The 12 agent workstations and existing collision/interaction system.
- Existing GLB office desk/computer/headset integration.
- Staff, customer and supervisor GLB systems.
- Recruitment, briefings, customer handling, CRM, QA and workforce screens.
- Existing player controls, renderer and render loop.

This stage upgrades the reception/lobby zone only. Other office zones still contain existing procedural architecture and furniture until compatible real assets are integrated.
