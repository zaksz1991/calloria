# CALLORIA v6.60 — Verification Report

**Verification date:** 17 November 2026  
**Source:** User-provided `calloria.zip`, with the previous v6.59 cumulative upgrade retained as the starting source tree.  
**Runtime used:** Node.js v22.16.0

## v6.60 focused verification

- Supervisor queue engine tests: passed.
- Supervisor UI integration tests: passed.
- Existing v6.59 live queue tests: passed.
- Existing v6.58 Try-It Studio tests: passed.
- Existing operations-engine tests: passed.
- Combined focused run: **66 passed, 0 failed**.
- `npm run check`: passed, including `main.js`, `production-world.js`, `live-queue-engine.js` and `supervisor-queue-engine.js` syntax checks.

## Full repository test run

Before v6.60, the supplied v6.59 source tree reported:

- 1,790 tests
- 1,245 passed
- 545 failed

After v6.60, after updating the package-manifest contract for the intentionally extended `check` script:

- 1,814 tests
- 1,269 passed
- 545 failed

The suite retained **545 pre-existing failure instances across 527 distinct failing test names**. The set of failing test names was identical before and after v6.60; no additional full-suite failure was introduced. The 24 tests added for v6.60 all pass. The package-manifest test was updated to recognise the expanded syntax-check command; this removes one temporary test mismatch caused by the intended script change.

## Production build and deployment boundary

- `npm run build` was attempted but could not start because the uploaded source snapshot has no installed `node_modules`; the environment reported `vite: not found`.
- Dependency installation was not completed in this environment.
- No browser walkthrough, Vercel deployment, Supabase write, real-provider action, phone-device test or production runtime verification is claimed.

## Asset boundary

The user-provided `calloria.zip` does not contain `public/assets/` or the GLB binary assets. The v6.60 archive retains all files present in the supplied repository and does not fabricate or replace missing public assets. Preserve the existing production `public/assets/` folder when merging into a repository checkout that has it.
