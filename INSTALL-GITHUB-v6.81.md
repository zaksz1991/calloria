# CALLORIA v6.81 — GLB Asset Path Recovery

**Target repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`

## What this release changes

The current GLB integrations request only the exact `.glb` path held in the asset registry. Your known asset layout also includes model folders containing a generic `model.glb`. v6.81 preserves each registered URL as the first attempt, then tries the equivalent `<asset-name>/model.glb` path if the first request fails. This applies to staff and office GLBs.

The staff integration also falls back to the two primary agent candidates only when the saved inspector selection contains no eligible staff candidate. A valid selection of one or more agent models remains respected. This prevents stale or office-only approvals from disabling all staff candidates.

## Files in this overlay

- `build/calloria-glb-world-plugin.js` — complete replacement; already registered in `vite.config.js`.
- `js/glb-asset-path-fallback.js` — new same-origin path resolver and sequential loader.
- `tests/calloria-glb-path-fallback-v681.test.mjs` — focused regression tests.
- `VERIFICATION-v6.81.md` and `TEST-RESULTS-v6.81.txt` — validation record.

## Install with GitHub Desktop and File Explorer

1. Download and extract `CALLORIA-v6.81-GLB-PATH-RECOVERY.zip`.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Merge the supplied `build`, `js` and `tests` folders into the existing repository root. Allow the included plugin file to replace the existing matching file.
5. Do not replace `vite.config.js`; it already registers `calloriaGLBWorldPlugin()`.
6. Preserve `.git`, all `public/assets/` files and GLB models, local environment files, Supabase configuration and Vercel settings.
7. Review the changed-file list. Commit with summary `CALLORIA v6.81 — GLB asset path recovery` and push to `main`.
8. Wait for the existing Vercel project to finish its production deployment. Do not treat a queued or failed build as deployed.

## Post-deployment checks

1. Open CALLORIA in a fresh mobile browser session and enter the 3D workplace.
2. Confirm the asset status reports a non-zero staff count and/or office object count if the corresponding model files exist at either supported path.
3. Open `/asset-inspector.html` on the same origin and inspect failed model entries. A failed load now includes both tried paths in its error.
4. Confirm that an intentionally selected staff-model list remains selected when it contains at least one eligible agent ID.
5. Confirm an empty, stale, or office-only approval list falls back to the two primary agent candidates.
6. Repeat the same checks on desktop.

## Scope and boundaries

- No GLB binaries are included. Existing user assets are not overwritten.
- No database migration, Supabase Edge Function, secret, environment variable or dependency is added.
- The release does not generate fake GLBs or claim a model is placed when it was not loaded and validated.
- It cannot make a missing or corrupt binary load. The exact attempted paths and errors remain visible for diagnosis.
