# CALLORIA v6.83 — Single Mobile-Safe GLB Diagnostics Panel

**Repository:** `zaksz1991/calloria`  
**Production branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Required baseline:** v6.82 GLB Runtime Load Trace & Health Panel

## Why this patch exists

A source scan of the current `main` branch found two separate GLB diagnostic interfaces:

1. The v6.82 `3D ASSET STATUS` button and collapsible runtime report (`js/glb-asset-health-panel.js`).
2. The older `#calloriaGlbAudit` details card inserted by `build/calloria-ojt-glb-activation-plugin.mjs`.

The older card is automatically opened whenever the GLB result has zero staff and zero office placements or reports a failure. Its CSS puts it at the upper-left of the immersive HUD with up to 34–42% of the phone viewport height. This is consistent with the large yellow-bordered diagnostics card visible in the supplied phone screenshot. The new report was not lifecycle-bound to immersive mode, so its button could also appear outside the 3D workplace.

v6.83 consolidates the display into the v6.82 report without removing its telemetry or changing the actual GLB loader.

## Files in this overlay

- `js/glb-asset-health-panel.js` — complete replacement. The status button is hidden outside `body.calloria-game-playing`, is revealed on `calloria:world-immersive`, and hides/closes on exit. A body-class observer is retained as a fallback if the event is missed. The legacy `#calloriaGlbAudit` card is suppressed to prevent duplicate overlays. Previous panel instances are disposed before a new instance is attached.
- `tests/calloria-glb-diagnostics-consolidation-v683.test.mjs` — lifecycle, duplicate-panel, visibility, event cleanup and status-summary regression tests.
- `VERIFICATION-v6.83.md` and `TEST-RESULTS-v6.83.txt` — evidence and boundaries.

## Install using GitHub Desktop / File Explorer

1. Back up the existing CALLORIA repository checkout.
2. Extract `CALLORIA-v6.83-GLB-DIAGNOSTICS-CONSOLIDATION.zip`.
3. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Merge the supplied `js` and `tests` folders into the repository root. Replace only `js/glb-asset-health-panel.js`; add the v6.83 test file.
6. Keep the existing v6.82 `build/calloria-glb-world-plugin.js`, `js/glb-asset-path-fallback.js`, Vite plugin registration and GLB integration modules. Do not add a second registration of `calloriaGLBWorldPlugin()`.
7. Keep `.git`, `public/assets/`, all GLB binaries, all other project files, local environment files and current Supabase/Vercel configuration untouched.
8. Review the changed-file list. Commit with summary `CALLORIA v6.83 — single immersive GLB diagnostics panel`, then push to `main`.
9. Confirm Vercel reports a successful production build before treating the update as deployed.

## Phone acceptance checks

1. Load CALLORIA and remain on the recruitment/home/assessment screens. The GLB status button and report must not be visible.
2. Enter the 3D workplace. One small `3D ASSET STATUS` button should appear; the older yellow-bordered `GLB STAFF / OFFICE OBJECTS` card must not appear.
3. Tap the button. The detailed runtime report should open and continue to show the v6.82 loader-attempt telemetry and real staff/office placement counts.
4. Close the report with its close button or Escape.
5. Exit the 3D workplace. The status button and report must both disappear.
6. Re-enter the workplace. The button should reappear without duplicating event handlers or panels.
7. Repeat at a narrow portrait width and after rotating the phone.

## Scope limits

- This patch fixes duplicate/always-visible diagnostic UI. It does not claim that missing GLB files, failed decoding, model validation, or placement have been repaired.
- No GLB binaries, asset paths, staff selection rules, office placement plans, 3D geometry, database schema, Edge Function, API key, dependency or environment variable are changed.
- The source package is an overlay, not a complete repository replacement.
