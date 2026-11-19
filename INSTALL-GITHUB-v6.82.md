# CALLORIA v6.82 — GLB Runtime Load Trace & Health Panel

**Target repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Baseline:** v6.81 GLB Asset Path Recovery

## Purpose

The prior release added a second first-party file-path attempt, but the user still needs evidence of what the phone browser actually requested and why each request failed. v6.82 adds a collapsed, phone-safe asset report and emits the real staff/office GLB loader attempts into it.

The report does not create placeholder success states. It distinguishes a successful file load from a staff/office placement reported by the integration layer.

## Files in this overlay

- `build/calloria-glb-world-plugin.js` — complete replacement for the existing plugin; retains the v6.81 transforms and adds load-attempt reporting plus status-panel lifecycle.
- `js/glb-asset-health-panel.js` — new, collapsed mobile/desktop runtime status panel.
- `js/glb-asset-path-fallback.js` — the v6.81 same-origin path resolver, included unchanged so the new plugin has its required dependency.
- `tests/calloria-glb-path-fallback-v681.test.mjs` — retained path-recovery regression suite, updated for the telemetry callback.
- `tests/calloria-glb-runtime-health-v682.test.mjs` — new telemetry, status summary, transform and panel regression tests.
- `VERIFICATION-v6.82.md` and `TEST-RESULTS-v6.82.txt` — verification record.

## Install with GitHub Desktop / File Explorer

1. Back up the existing local CALLORIA repository folder.
2. Extract `CALLORIA-v6.82-GLB-RUNTIME-HEALTH.zip`.
3. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Merge the archive's `build`, `js` and `tests` folders into the existing repository root. Allow the matching `build/calloria-glb-world-plugin.js` and `js/glb-asset-path-fallback.js` files to be replaced. Add `js/glb-asset-health-panel.js` and the new test file.
6. Keep the existing `vite.config.js`; v6.81 already registered `calloriaGLBWorldPlugin()`. Do not create a second plugin registration.
7. Preserve `.git`, `public/assets/` and all GLB binaries, all other application modules, local environment files and existing Supabase/Vercel configuration. This archive is an overlay, not a full repository snapshot.
8. Review the changed-file list. Commit with summary `CALLORIA v6.82 — GLB runtime load trace and health panel`, then push to `main`.
9. Treat the release as deployed only after the existing Vercel project reports a successful production deployment.

## Phone verification

1. Open CALLORIA in a fresh phone browser session and enter the 3D workplace.
2. A small **3D ASSET STATUS** button should appear at the upper-left. It is collapsed by default and does not display the old large diagnostic card.
3. Open it. The report should show staff GLBs loaded, office objects placed, local staff fallbacks and failed file paths.
4. Expand **Actual model file attempts**. Each actual request should identify its channel (`staff` or `office`), model ID/name, requested path and outcome. Failed attempts should include the browser loader error.
5. Check whether at least one staff GLB is loaded and whether the office integration placed any object.
6. If both counts remain zero, use the reported paths/errors to identify whether the problem is absent files, HTTP routing, CORS/network failure, GLB parse/validation failure, or an integration layer that did not start. Do not infer which failure occurred without the recorded evidence.
7. Open **Open full asset inspector** from the report for the full catalog view.
8. Repeat on desktop.

## Scope and boundaries

- No new dependency, database migration, Edge Function, secret or environment variable.
- No GLB binaries are added or replaced.
- The new report records attempts made by the existing staff and office GLB loaders. It does not scan unknown directories, repair missing/corrupt files, or force an invalid model to render.
- No complete current repository ZIP was available for this release. This is explicitly an updated-files overlay based on the v6.81 plugin and path resolver, not a cumulative replacement of every CALLORIA source file.
