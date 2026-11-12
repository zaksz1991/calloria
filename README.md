# CALLORIA v6.13 — Office GLB Runtime Repair & Asset Diagnostics

This patch repairs the office-model runtime path used by `production-world.js`. It focuses on the real workstation models already listed in `js/glb-asset-registry.js`:

- `office/desks/office_desk.glb`
- `office/equipment/office_computer.glb`
- `accessories/headsets/model.glb`
- `office/reception/reception-desk.glb`

## What changes

- Keeps the existing `integrateCalloriaGLBOfficeAssets()` public API.
- Preserves the exact v2.9 workstation-plan and v3.8 Meshopt/Draco transform anchors.
- Uses tier-specific geometry budgets; increases the permitted mesh-part count for complex furniture while keeping lower-tier limits tighter.
- Loads desk, computer, headset and reception assets independently. One unavailable GLB no longer prevents other asset categories from appearing.
- Keeps primitive/instanced fallbacks visible until a real GLB has passed validation and has actually been placed.
- Reports loaded asset IDs, placement counts, model dimensions, triangle counts, HTTP/loader failures, validation failures and placement failures.
- Emits `calloria:office-glb-status` with the same detailed report shown through the production-world callback.
- Prevents duplicate office asset layers when the same scene is initialized more than once.
- Fits each loaded model inside its target workstation dimensions and keeps mesh shadows disabled for predictable mobile performance.

This patch does not add substitute models, fabricate textures, create animation clips, or claim that a model loaded when it did not.

## Installation

Copy these two files into the repository:

1. Replace `js/glb-office-world-integration.js` with the file in this package.
2. Add `js/glb-office-asset-policy.js`.

Do not replace `vite.config.js`, `js/production-world.js`, the GLB registry, or the mobile/avatar repair files. Preserve the existing `public/assets/models/` directory.

The existing page routes remain unchanged. The office model layer is loaded from the 3D workplace route.

## Expected diagnostics

The existing world callback receives:

- `placed` / `officeObjectsPlaced`: actual GLB object instances added to the scene.
- `assets` / `loadedAssetIds`: model IDs that actually loaded.
- `failedAssetIds`: models that failed to load or validate.
- `assetDetails`: per-model URL/path, dimensions, mesh/triangle/texture counts and placement status.
- `errors`: exact loader, validation or placement messages.

A missing GLB now reports its concrete path/loader error instead of the generic message that no compatible placement was reported. Primitive fallback pieces are not hidden on failed loads.

## Scope and integration boundary

- Staff character loading remains separate and is handled by v6.12 plus the existing staff runtime transform.
- This patch does not change player avatar visibility or the first-person mobile camera.
- The files in your GitHub repository were not available for direct visual inspection here. Actual office GLBs, deployed HTTP paths, Vercel build, and Android rendering still require verification in your repository and deployed site.
