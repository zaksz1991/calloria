# CALLORIA v1.4 — Customer Behaviour + 3D Customer Avatar

This is an additive upgrade for the current `main` branch. It adds a real GLB-backed customer view to the existing synthetic Customer Intelligence Lab and expands the customer behaviour set.

## Only one existing file is replaced

- `vite.config.js` — complete replacement based on the current repository version, retaining the existing GLB world plugin, Meshopt runtime plugin, all Vite multi-page entries, and adding the customer-avatar plugin.

## New files

- `build/calloria-customer-avatar-plugin.js`
- `js/customer-avatar-stage.js`
- `js/customer-avatar-profile.js`
- `styles/calloria-customer-avatar.css`
- `tests/customer-avatar-plugin.test.mjs`
- `tests/customer-avatar-profile.test.mjs`
- `INSTALL.md`
- `CHANGELOG.md`

## Preserved

No replacement of `main.js`, `production-world.js`, `customer-intelligence-engine.js`, `package.json`, lockfile, existing Supabase files, or original GLB assets.

The Vite plugin modifies `main.js` and `customer-intelligence-engine.js` only at build time and only when all expected source anchors occur exactly once. If the repository source changes unexpectedly, the build fails instead of silently applying an incomplete injection.

## Runtime behaviour

The avatar is a visual representation of the synthetic practice customer inside Customer Intelligence Lab. It is not presented as a physical in-office customer or live caller video.

Only customer/visitor models explicitly approved in the existing GLB Asset Inspector are considered. A model must pass runtime checks for human scale, skeleton, bone count, triangle count, mesh count and texture dimensions. If no approved compatible model exists, the simulation continues and shows a clear message linking to the GLB Inspector.

The model stage is limited to one character and follows the existing customer reaction state after each agent response.
