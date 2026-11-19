# CALLORIA v6.81 — Verification

## Implemented

- Added a same-origin GLB path resolver. The registry URL remains the first load attempt.
- Added a second candidate for the known folder layout: `<asset-name>/model.glb`.
- Applied path recovery to both staff and office model loading through the existing registered Vite plugin.
- Added staff-candidate recovery when a saved inspector list contains no eligible staff IDs. Valid selected staff IDs are not overridden.
- Preserved existing model validation, decoder configuration, placement rules, fallback meshes and asset registry.
- Added error details listing every attempted URL when a model cannot be loaded.

## Verification boundary

The focused tests exercise URL selection, retry order, safe-origin rejection, error reporting and Vite source transforms. They do not have access to the user's deployed `public/assets/models` binaries, so they cannot prove that a specific file exists, decodes, passes validation or is visible in a live phone browser. The production Vite build and Vercel deployment are not claimed as successful in this package.
