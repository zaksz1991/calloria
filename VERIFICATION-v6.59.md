# CALLORIA v6.59 — Verification Record

**Date:** 17 November 2026  
**Source:** User-provided `calloria.zip` repository snapshot  
**Feature release:** v6.59 Live Queue Operations  
**Package manifest version:** `0.3.0` (retained unchanged)

## Delivered source changes

- Added `js/live-queue-engine.js` for deterministic inbound arrival scheduling, accelerated-clock queue timestamps, priority-based patience, abandonment, queue-capacity enforcement, and manual demand-surge capacity controls.
- Integrated the engine into `js/main.js` shift lifecycle, queue rendering, call acceptance, contact lifecycle timestamps, operations timeline, saved-state migration, and next-workday reset.
- Updated agent and queue-supervisor views to separate opening queue contacts, automatic arrivals, and manual demand surges, and to expose abandonment and overflow metrics.
- Added 23 v6.59 engine and integration regression tests.
- Preserved the v6.58 Try-It Studio implementation and its Vite registration. The existing v6.58 plugin file and v6.58 test file remain byte-for-byte identical to the supplied source snapshot.
- No new dependency, Supabase migration, environment variable, secret or external provider integration was introduced.

## Checks run

| Check | Result |
|---|---|
| `npm run check` | Passed: `js/main.js` and `js/production-world.js` syntax checks |
| `node --check js/live-queue-engine.js` | Passed |
| Focused regression run (v6.59 engine + integration, v6.58 Try-It Studio, operations engine) | **42 passed, 0 failed** |
| Full `npm test` | **1,245 passed, 545 failed** out of 1,790 |
| `npm run build` | Not successful: `vite: not found` |

The supplied source snapshot has no installed `node_modules` directory. The earlier dependency-install attempt timed out, so Vite was unavailable for a production bundle. The full test run was also run against the supplied baseline before v6.59: it had 1,767 tests, 1,222 passed and 545 failed. The current run has 23 additional tests, all passing; the same 545 pre-existing failing test names remain, with no additional failing test names introduced by v6.59.

## Not verified

- A successful Vite production build.
- A Vercel deployment or production URL smoke test.
- A live desktop browser acceptance session for queue arrivals and abandonment.
- Physical Android/iPhone gameplay, mobile 3D rendering or GPU performance.
- Real telephony, dialler, CRM, or external customer integration; v6.59 intentionally creates synthetic game contacts only.

## Asset limitation

The uploaded `calloria.zip` did not contain `public/assets/` or the GLB model binaries. This release preserves all files present in the uploaded snapshot but cannot reconstruct assets that were not supplied. When merging the archive into the existing local/GitHub repository, retain any existing `public/assets/` folder and its models. No substitute placeholder asset folder has been invented.

## v6.58 preservation

The v6.58 Try-It Studio build module, test file, and registration in `vite.config.js` were compared with the uploaded source snapshot and remain unchanged. The existing v6.58 feature tests also passed in the focused regression run.
