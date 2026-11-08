# CALLORIA GLB Asset Inspector — installation overlay

This overlay is prepared against the public `main` repository tree shown by the user and the current root Vite configuration.

## Files in this overlay

- `package.json` — complete replacement; defines the Vite build/test scripts and the existing runtime package imports used by CALLORIA (`three`, `@supabase/supabase-js`).
- `vite.config.js` — complete replacement; preserves the existing HTML entry points and widget output, adds `/asset-inspector.html`, and enables copying `public/` into `dist/`.
- `asset-inspector.html` — new stand-alone inspector page.
- `js/glb-asset-registry.js` — inventory for the 16 GLBs listed in the repository tree.
- `js/glb-asset-loader.js` — reusable GLTFLoader wrapper, skinned-mesh-safe cloning, resource disposal and inspection metrics.
- `js/glb-asset-inspector.js` and `styles/glb-asset-inspector.css` — browser preview, sequential catalogue scan, metrics, warnings and JSON report export.
- `tests/glb-asset-contract.test.mjs` — registry and build-configuration contract tests.

## Install

Copy the files in this overlay into the matching locations in the CALLORIA repository, preserving all other files. Replace only the root `package.json` and `vite.config.js` with the complete versions in this overlay. Add the new files at the paths shown.

Do not copy model binaries from this overlay; the existing files under `public/assets/models/` remain the source assets.

## First use

Open `/asset-inspector.html` on the deployed CALLORIA site. The page initially loads `female-agent.glb`. Use the model list to preview each asset. The full scan loads files sequentially and checks whether the browser GLTFLoader can parse them; it does not certify visual quality or runtime performance. Export the JSON report after the scan.

## Asset delivery correction

The previous Vite configuration used `publicDir: false`, which prevented Vite from copying `public/assets/models/` into the deployment output. This replacement sets `publicDir: 'public'`. With `base: '/'`, a repository file such as `public/assets/models/characters/agents/female-agent.glb` is requested at `/assets/models/characters/agents/female-agent.glb`.

## Verification limits

This package cannot include the existing repository source tree or the GLB files. The full project build and existing regression suite must run in the repository after the overlay is applied. The included contract tests validate the overlay structure and asset paths; they do not download or inspect the GLB binaries.

The live production-world renderer is intentionally not replaced in this phase. The inspector and reusable loader are delivered first so actual GLB structure, rigging, animation and geometry can be measured before changing `js/production-world.js`.
