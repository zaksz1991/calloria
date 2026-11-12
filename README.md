# CALLORIA v6.17 — Reception Lobby GLB Activation

## Purpose

Activate the existing CC0 reception-lobby scene inside the production CALLORIA Three.js office. This is an extension of the v6.16 office runtime, not a second office scene or renderer.

## What changes

- Adds the complete Office Lobby and Building Facilities GLB from 3DAssets.dev.
- Uses the same configured Three.js `GLTFLoader` already used for office assets, including the existing Draco and Meshopt setup.
- Sets anonymous cross-origin loading for the publisher CDN.
- Validates dimensions, triangles, mesh count, material count and texture edge before placement.
- Batches compatible static meshes by material and vertex-attribute signature. If safe batching is not possible, it keeps the authored model intact instead of dropping meshes.
- Places the lobby in the front-left reception footprint at 80% scale.
- Replaces the procedural reception counter, check-in screen, waiting seats and access-control props only after the complete lobby has loaded, passed validation and entered the scene.
- Retains a second fallback: if the full lobby cannot load, CALLORIA tries the existing standalone reception-desk GLB. If that also fails, the original procedural reception remains visible.
- Restores hidden reception objects and disposes generated geometry when the 3D world is disposed.
- Adds lobby status to `calloria:office-glb-status` and emits `calloria:glb-lobby-ready` with the model diagnostics.
- Keeps the existing desks, computers, headsets, ergonomic task-chair activation, staff runtime, mobile camera, controls and animation loop intact.

## Device tiers

| Graphics tier | Lobby behaviour |
|---|---|
| Low | Skips the 1.3 MB lobby GLB; keeps the procedural reception |
| Balanced | Loads and validates the lobby GLB |
| High | Loads and validates the lobby GLB |

The source model is about 32,204 triangles, 99 meshes and 7 materials. Compatible geometry is reduced to material/attribute batches; if the source changes or batching is unsafe, the runtime retains the original meshes.

## Asset and licence

- Model: Office Lobby and Building Facilities — starter scene
- Source page: `https://3dassets.dev/packs/office-lobby-and-facilities`
- Runtime file: `https://cdn.3dassets.dev/assets/26326/v1/model.glb`
- Licence: CC0 1.0 Universal
- Licence text: `https://creativecommons.org/publicdomain/zero/1.0/`

The GLB is fetched by the browser at runtime; it is not bundled into this ZIP or copied into GitHub. The publisher's CDN must remain reachable and permit CORS. When it is unavailable, existing reception geometry is retained.

## Files in this patch

- `js/glb-office-world-integration.js` — complete v6.16 office runtime with the new lobby integration added.
- `js/cc0-office-lobby-integration.js` — lobby loading, validation, batching, placement and cleanup.
- `js/cc0-office-lobby-policy.js` — Three.js-free asset metadata, tier rules, fallback names and geometry limits.

## What is not changed

- No `vite.config.js`, `package.json` or `package-lock.json` changes.
- No staff GLB build plugin changes.
- No `production-world.js`, renderer, camera, player controls, recruitment or assessment changes.
- No changes to agent customer-contact workflows, QA, CRM or career progression.

## Verification boundary

The focused suite tests the geometry policy, tier rules, fallback ordering, cleanup contract, status aggregation and retained v6.16 desk/computer/headset/chair and Draco/Meshopt integration paths. It does not download the live lobby GLB, prove CDN availability, run a full Vite build, deploy to Vercel or verify Android rendering.
