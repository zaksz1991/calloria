# CALLORIA v6.63 — Verification Report

**Date:** 17 November 2026  
**Release:** Digital First-Response SLA Control  
**Base:** supplied cumulative v6.62 repository snapshot  
**Backup:** `CALLORIA-BACKUP-BEFORE-v6.63.zip`

## Verification results

| Check | Result |
|---|---:|
| New v6.63 engine tests | 17 passed, 0 failed |
| New v6.63 agent UI integration tests | 10 passed, 0 failed |
| New v6.63 supervisor integration tests | 5 passed, 0 failed |
| New v6.63 tests combined | **32 passed, 0 failed** |
| Selected cumulative regression suite | **156 passed, 0 failed** |
| `npm run check` | Passed |
| Full v6.63 repository suite | 1,899 total; 1,355 passed; 544 failed |
| v6.62 backup full-suite baseline | 1,867 total; 1,323 passed; 544 failed |
| Full-suite failure-name comparison | Same 526 distinct failing test names; no new failing name and no existing failing name resolved |
| ZIP archive integrity | Checked with `unzip -t`; see packaged result |
| Vite production build | Not verified: `vite: not found` in the supplied workspace |
| Browser walkthrough / physical mobile test | Not run |
| Vercel deployment | Not performed or claimed |

Raw `npm run check`, selected regression, full-suite and build outputs are included in the archive. The direct baseline comparison and original v6.62 recheck log are also included.

The full repository test suite is **not clean**. The 544 failing test records already exist in the exact v6.62 backup baseline. The complete suite has 32 additional v6.63 tests, all passing. The same 526 distinct pre-existing failing test names remain; no test failure has been described as fixed.

The selected cumulative regression run covers v6.59 queue operations, v6.60 supervisor board, v6.61 digital demand, v6.62 concurrent agent workload, v6.63 SLA control, the existing operations engine and multichannel engine. It is a selected release regression suite, not a substitute for the full repository suite.

## Behaviour checked

- Deadline calculation honours the target saved on each contact and falls back to channel defaults for invalid/missing targets.
- The default risk window starts at 75% of target elapsed.
- Late and timely first responses retain their original outcome after the agent responds or a customer follow-up arrives.
- Risk, breach and met timeline events are written once rather than duplicated on every shift tick.
- Contacts waiting for a customer without an initial response are not incorrectly monitored as open first-response work.
- Completed/resolved/escalated contacts are excluded from the open-response backlog metrics.
- Agent work tabs, digital queue rows, the active conversation banner and supervisor queue risk/breach totals include both waiting and active digital work; waiting-contact triage rows show per-contact status.
- The monitor advances on the simulated shift clock and integrates with the existing digital and operations event histories.

## Build and runtime limitations

`npm run build` was attempted and stopped because the supplied workspace has no installed Vite binary (`vite: not found`). The production bundle therefore remains unverified. No browser-based visual walkthrough, actual Android/iPhone test, successful Vercel build or live deployment is claimed.

The supplied repository ZIP did not contain `public/assets/` or the GLB binaries. The release preserves the source archive it received but cannot recreate omitted assets. Keep the actual `public/assets/` directory and models from the user's GitHub checkout when merging.

## Change boundaries

- No Supabase migration or remote database mutation.
- No provider key, API secret, environment variable or external dependency added.
- No live email, social, live-chat or telephony provider is connected.
- No contractual SLA, regulatory compliance or commercial production-readiness claim is made.
- Existing v6.62 and earlier cumulative gameplay modules remain present in the release source.
