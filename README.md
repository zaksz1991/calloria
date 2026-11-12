# CALLORIA v6.15 — Draco-compressed Office GLB Support

This release targets a likely runtime gap in the existing office GLB loader. The v6.13 office integration configured `GLTFLoader` with `MeshoptDecoder`, but did not configure `DRACOLoader`. If an office model uses `KHR_draco_mesh_compression`, Three.js cannot decode its geometry without a DRACO loader. That can leave office objects at zero even when the GLB exists and its path is correct.

## Changes

- Adds Three.js `DRACOLoader` to the office GLB runtime.
- Keeps Meshopt decoding enabled; these are independent compression extensions.
- Uses the pinned DRACO 1.5.7 WASM decoder from Google's public decoder CDN by default.
- Allows a same-origin or alternate decoder folder to be configured before the 3D world starts with `window.CALLORIA_DRACO_DECODER_PATH` (the folder must contain the standard `draco_wasm_wrapper.js` and `draco_decoder.wasm` files).
- Disposes DRACO workers when the office scene is disposed.
- Preserves all v6.13 office model validation, workstation placement, fallback visibility and v2.9/Vite transform anchors.
- Improves failed-model records so the diagnostics retain the model's path and URL and classify DRACO, network/HTTP, GLB parse, validation and placement failures.
- Does not hide procedural fallback furniture until its corresponding GLB is actually placed.

## Files

Replace:

- `js/glb-office-world-integration.js`

Add:

- `js/glb-office-draco-policy.js`

The package deliberately does not include `package.json`, `package-lock.json`, `vite.config.js`, `production-world.js`, any build plugin, or GLB files.

## Installation

Use the same two file paths shown in `INSTALL-GITHUB.md`. Preserve all other files, especially the v6.14 staff plugin, the v6.11 mobile/avatar changes, the v6.13 office asset policy, and `public/assets/models/`.

## What this does not prove

The repository's office GLBs were not available for inspection in this workspace. The patch enables the missing decoder path if a model uses Draco; it does not prove that any specific deployed office GLB is Draco-compressed, present, reachable, or visually well-positioned. The next deployed runtime status should show per-asset load and placement diagnostics. Full Vite build, Vercel deployment and Android rendering have not been run here.
