# CALLORIA v6.61 — Verification Report

**Verification date:** 17 November 2026  
**Source:** Supplied `calloria.zip` tree with the previous v6.60 cumulative upgrade retained.  
**Runtime:** Node.js v22.16.0

## v6.61 focused verification

- New digital live queue engine and UI integration tests: **21 passed, 0 failed**.
- Combined focused regression run across v6.61, v6.60, v6.59, v6.58 Try-It Studio and the operations engine: **87 passed, 0 failed**.
- The focused tests cover channel-specific schedules, automatic email/live-chat/social arrivals, organisation response-target use, per-channel capacity and overflow, waiting-status capacity accounting, demand-profile interval changes, no catch-up bursts after tab suspension, intake shutdown, save normalisation, next-workday reset, metrics snapshots, primary-app clock integration, timeline logging, supervisor profile integration, one-time opening seed, agent/supervisor visibility and mobile styling.
- `npm run check`: **passed**. It syntax-checks `js/main.js`, `js/production-world.js`, `js/live-queue-engine.js`, `js/supervisor-queue-engine.js` and `js/digital-live-queue-engine.js`.

## Full repository test suite

The v6.60 baseline reported 1,814 tests, 1,269 passed and 545 failed (527 distinct failing test names).

After v6.61:

- **1,835 tests**
- **1,291 passed**
- **544 failed**
- **0 skipped**

The full-suite failure count is lower by one failure instance than the v6.60 baseline. Comparing distinct failing test names, v6.61 introduces **no new failing test name**; one previously failing asset/roadmap documentation contract now passes. The remaining 544 failure instances are legacy repository test failures and are not represented as passing or repaired by this release. The 21 new v6.61 focused tests all pass.

The suite was executed with `npm test`; its non-zero exit status reflects the remaining legacy failures.

## Production build and deployment boundary

- `npm run build` was attempted and stopped with `vite: not found` because Vite is not installed in this source workspace.
- Dependency installation was not completed for this verification.
- No successful Vite production bundle, browser session, real phone-device session, Vercel deployment, Supabase write or external-provider action is claimed.

## Asset boundary

The uploaded repository snapshot did not include `public/assets/` or the user's GLB binaries. This release keeps the files present in the upload and does not fabricate replacement models. When merging into the actual GitHub checkout, preserve its existing `public/assets/` directory, GLB files, other locally held assets and hidden `.git` directory.

## Data and integration boundary

All digital arrivals, customers, messages, queues, timelines and metrics introduced here are synthetic local simulation data. This release adds no database migration, provider secret, environment variable, external API connection or package dependency. The digital response target and channel capacities are illustrative simulation values, not organisation-approved contractual service levels.
