# CALLORIA GLB staff motion upgrade v1.3

## Purpose

This update completes the runtime stage already prepared by the existing Vite build plugins:
- `calloriaGLBWorldPlugin()` injects the GLB integration into the production world.
- `calloriaMeshoptRuntimePlugin()` registers Meshopt decoding at both GLTFLoader construction sites and removes the old Meshopt rejection at build time.

This package replaces the GLB staff integration module and adds a small bone-aware idle helper for standing staff. It does not replace `main.js`, `production-world.js`, `vite.config.js`, `package.json`, Supabase files, or source GLB assets.

## Install

Copy the included `js/glb-world-integration.js` over the existing file, add `js/glb-character-motion.js`, and add `tests/glb-character-motion.test.mjs`.

## Runtime behaviour

- The two primary models (`male-agent`, `female-agent`) are tried automatically when the inspector has no explicit approvals. All candidates still pass strict dimension, skeleton, bone, triangle, mesh and texture checks.
- If the inspector contains explicit approved IDs, those selections take precedence.
- Seated positions are replaced only when a seated/typing animation clip is present. Otherwise the original seated staff remain visible.
- Standing non-walking support positions can use a low-amplitude skeletal idle motion when the model has a usable rig but no embedded idle clip.
- All other positions retain the existing local staff fallback.
- Existing Meshopt build-time registration remains in place. The exact loader and extension-guard anchors are intentionally preserved for the current Vite transform plugin.
- Source GLB resources are disposed correctly after their instances are removed.

## Verification

Run the repository's existing `npm test` and `npm run build` checks after installation. This package's standalone motion-helper tests can also be run with Node's built-in test runner.

Actual visual suitability, pose quality and device FPS still require browser testing against the deployed GLB files. No claim of full production verification is made here.
