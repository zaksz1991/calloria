# CALLORIA v2.8 — Staff GLB Runtime Compatibility

## Why this upgrade exists

The current `js/glb-world-integration.js` still rejects every character whose skeleton has fewer than 15 bones and rejects `EXT_meshopt_compression`, despite the project using Meshopt elsewhere. The staff loader also does not register `MeshoptDecoder`.

This upgrade patches that specific staff runtime. It does not replace the world renderer or game systems.

## Install

Merge the ZIP into the repository root.

**Replace:**
- `vite.config.js`

**Add:**
- `build/calloria-glb-staff-runtime-plugin.mjs`
- `tests/calloria-glb-staff-runtime.test.mjs`

Do not replace `main.js`, `production-world.js`, `glb-world-integration.js`, `world-player-avatar.js`, `glb-office-world-integration.js`, `package.json`, the lockfile, or any model files.

The replacement Vite config is based on the current `main` branch configuration observed on 9 November 2026. It preserves all existing plugins and build entries, then registers the compatibility patch last.

## Behaviour

- Registers the Meshopt decoder in the existing staff GLTFLoader.
- Allows `EXT_meshopt_compression` assets to load.
- Continues to reject `KHR_draco_mesh_compression` because a Draco decoder is not registered in this staff loader.
- Removes the arbitrary 15-bone minimum. A usable rig means at least one skinned mesh and one skeleton.
- Allows mesh-only/static GLB characters at standing staff positions.
- Does not put an unanimated static model into a seated agent position.
- Uses embedded seated/work clips when available; otherwise keeps the current seated procedural character.
- Reports static and animated GLB placements separately.
- Keeps the existing mobile tier limits, triangle limits, texture limits, candidate approvals, fallback behaviour and resource disposal.

## Important

This is a code compatibility correction, not proof that a particular downloaded GLB is visually suitable. The real model still has to pass dimensions, triangle, mesh and texture checks. The browser's `assetStatus` will report actual loaded staff and rejected assets after deployment.
