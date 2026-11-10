# Install CALLORIA v3.7.0 using GitHub Desktop

## Baseline requirement

This patch targets `zaksz1991/calloria` branch `main`, commit `96649f9` (the commit in the Vercel failure log supplied on 10 November 2026).

Do not overlay it on a later, different repository state without comparing the changed `vite.config.js` and the six source-transform anchors. The patch intentionally removes the failed v3.5 plugin registration and replaces it with v3.7.

## Copy the files

1. Download and extract `CALLORIA_v3_7_Onboarding_GLBAwakening_Patch.zip`.
2. Open the existing `calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the patch's `vite.config.js` into the repository root and replace that one file.
5. Copy the patch's `build` folder into the repository root, merging folders. Add the two new files:
   - `build/calloria-ojt-glb-activation-plugin.mjs`
   - `build/calloria-ojt-runtime.js`
6. Copy the patch's `tests/calloria-v37-onboarding-glb.test.mjs` into the existing `tests` folder (create it only if the repository has no tests folder).
7. Do not copy the documentation into application directories; keep the release notes as reference material.

## Files deliberately not replaced

Do not replace `package.json`, `index.html`, `js/main.js`, `js/production-world.js`, `js/glb-world-integration.js`, `js/glb-office-world-integration.js`, `js/glb-asset-loader.js`, `js/world-player-avatar.js`, the GLB registry, existing model binaries, Supabase migrations or environment variables. The Vite plugin transforms the existing runtime sources at build time, preserving them in the repository.

Do not install the earlier v3.4, v3.5, v3.5.1 or v3.6 patches separately over this package. v3.7 replaces the broken v3.5 plugin registration on the stated baseline.

## Review and push

1. In GitHub Desktop, inspect the complete changed-file list. It should contain the root `vite.config.js`, the two new `build` files and the new focused test.
2. Commit with: `CALLORIA v3.7 — cross-industry OJT and GLB activation`.
3. Push to `main` and let the connected Vercel deployment run.

## Vercel acceptance checks

- The previous v3.5 `staff candidate-load loop end anchor` error must be absent.
- The v3.7 plugin must not report any missing required source anchor.
- The build output must include `draco/draco_decoder.js`, `draco/draco_decoder.wasm` and `draco/draco_wasm_wrapper.js`.
- Any `required GLB file is missing` warning must be investigated against the first-party `public/assets/models` tree; do not replace a missing binary with primitive geometry.
- In a browser, enter the 3D floor and confirm the full-screen player body is gone. Confirm the status display reports actual staff and office GLB placements, not just that the loader module exists.
- Test recruitment → employment offer → OJT → sign-off → briefing → desk → first customer interaction on desktop and an actual Android device.

A green Vercel build is necessary but not sufficient. Browser rendering, model fit, touch controls and the complete player journey still require manual verification.
