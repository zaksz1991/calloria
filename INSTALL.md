# CALLORIA Customer World Activation v1.7

## Purpose

The repository already contains `js/customer-world-integration.js` and `build/calloria-customer-world-plugin.js`, but the current `vite.config.js` does not import or register that plugin. As a result, the reception-customer layer and the customer-reaction event bridge are not applied during the Vite build.

This patch activates the existing v1.6 integration. It does not add a second renderer and does not replace gameplay or customer-intelligence source files.

## Apply

1. Replace the repository-root `vite.config.js` with the complete file in this package.
2. Add `tests/customer-world-activation.test.mjs`.
3. Keep the already-committed files below unchanged:
   - `build/calloria-customer-world-plugin.js`
   - `js/customer-world-integration.js`
   - `js/customer-avatar-profile.js`
   - `js/glb-asset-loader.js`
   - `js/glb-asset-registry.js`
4. Commit the two changed/added files to `main`.

Do not replace `package.json`, `package-lock.json`, `js/main.js`, `js/production-world.js`, the original GLB files, or any Supabase files.

## Checks

The new test runs under the existing `npm test` command (`node --test tests/*.test.mjs`). It verifies plugin registration order, world attachment/update/disposal transforms, reaction-event bridge composition with the existing Customer Avatar plugin, idempotence, and safe refusal when source anchors drift.

A complete production build and browser rendering still need to be confirmed by the repository's deployment after this patch is committed. This package does not claim those checks have already passed.
