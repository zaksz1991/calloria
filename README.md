# CALLORIA v3.8.1 — Runtime Decoder Anchor Repair

This is a complete replacement for `build/calloria-ojt-glb-activation-plugin.mjs` and the associated focused regression file. It carries forward the v3.8.0 runtime audit/HUD and repairs decoder wiring against the actual source modules in the current repository.

## Why this patch exists

The v3.8.0 transform expected a staff loader already written as `new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)` and a specific extension-guard expression. The current checked-in `js/glb-world-integration.js` instead constructs `new GLTFLoader()` and rejects Draco/Meshopt in `extensionsValid`. The shared `js/glb-asset-loader.js` also constructs its loader without the prior Meshopt setup line. Those differences can make the v3.8 build transform fail before the world starts.

## What v3.8.1 changes

- Adds the Meshopt and Draco imports when missing.
- Configures both decoders on the actual staff `GLTFLoader`.
- Replaces the old blanket compression rejection with a supported-extension allowlist for Draco and Meshopt.
- Configures both decoders on the office GLTFLoader while retaining the upstream workstation coverage plan.
- Configures both decoders on the shared catalogue GLTFLoader used by other registered asset paths.
- Keeps the existing OJT, first-person player protection, low-tier standing staff targets and actual placement HUD.

The plugin bundles the Three.js Draco decoder files into `/draco/` during Vite build. The runtime does not depend on Google-hosted decoder files.

## Installation

Replace these two complete files in the existing CALLORIA repository:

1. `build/calloria-ojt-glb-activation-plugin.mjs`
2. `tests/calloria-v37-onboarding-glb.test.mjs`

Do not replace `vite.config.js`, `package.json`, `main.js`, `index.html`, `production-world.js`, model binaries, or the existing OJT runtime. The replacement plugin remains registered by the current `vite.config.js`.

After installation, run the existing repository test command and Vercel production build. A successful build proves compilation only. Actual GLB use is confirmed only when the in-game `3D ASSET STATUS` panel reports non-zero staff/office placements and does not list model load failures.
