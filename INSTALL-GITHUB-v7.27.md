# CALLORIA v7.27 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release:** Digital Follow-up Coaching Sustainment Checkpoints

## Release type

This is a cumulative v7.23–v7.27 overlay containing the digital follow-up supervisor, performance, coaching, outcome-review and checkpoint modules. It is not a complete copy of the CALLORIA repository.

## 1. Back up and open the existing repository

1. Make a backup copy of the current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` folder. Do not delete or replace the existing repository.
5. Preserve `public/assets/`, every existing GLB model, local environment files and all unrelated project files.

## 2. Merge the release folders

1. Extract `CALLORIA-v7.27-DIGITAL-FOLLOWUP-COACHING-CHECKPOINTS.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.27` folder.
3. Merge its `build`, `js`, `styles`, `tests` and `docs` folders into the same folders in the existing repository. Add the v7.27 files and retain every unrelated file.
4. Copy `CHANGELOG-v7.27.md`, `README.md` and `INSTALL-GITHUB-v7.27.md` into the repository root if that is where the project keeps release documentation.
5. Review `vite.config.js` before replacing it. The supplied file is a v7.26 configuration snapshot with the v7.27 plugin added. Replace the actual file only if it still matches that baseline and contains no later project changes.
6. When the live Vite config has moved beyond the supplied snapshot, keep the live file and merge these two additions instead:

   Import alongside the existing CALLORIA plugin imports:

   `import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from './build/calloria-digital-followup-coaching-checkpoints-v727.mjs';`

   In the `plugins` array, immediately after `calloriaDigitalFollowUpCoachingOutcomesPluginV726()`:

   `calloriaDigitalFollowUpCoachingCheckpointsPluginV727(),`

7. Preserve plugin order: v7.23 supervisor → v7.24 performance → v7.25 coaching → v7.26 outcome reviews → v7.27 sustainment checkpoints.
8. In GitHub Desktop, inspect the changed-file list. Confirm no unrelated files disappeared and that `.git`, `public/assets/` and GLB models are untouched.
9. Commit with message `CALLORIA v7.27 — digital follow-up coaching sustainment checkpoints` and push to `main`.
10. Check the existing Vercel deployment result. Treat the release as deployed only after Vercel reports a successful production deployment.

## 3. In-game acceptance checks

1. Open the Supervisor workspace.
2. Complete a coaching plan and record its outcome review.
3. Confirm a 7-day and a 30-day checkpoint are added, with due dates calculated from the outcome review timestamp.
4. Confirm the checkpoint panel shows upcoming checks and accurate due/overdue/recorded totals.
5. Confirm a future checkpoint has no record action before its due date.
6. For a due checkpoint, record the result and confirm the before/reference value, current value, target, status and supervisor timestamp are visible.
7. Confirm the operation timeline records the checkpoint result.
8. Confirm a second attempt to record the same checkpoint is rejected.
9. Confirm response-target-rate checkpoints require at least three new completed follow-ups and workload-count checkpoints require at least one.
10. Confirm insufficient evidence is recorded as insufficient data, never treated as zero.
11. For an older v7.26 plan with an outcome review but no checkpoints, use **Schedule 7- and 30-day checks**.
12. Repeat at phone width and confirm checkpoint cards and buttons fit without horizontal scrolling.

## 4. Configuration and safety

- No Supabase SQL migration is required.
- No Supabase Edge Function deployment is required.
- No new environment variable, secret, API key, package dependency or provider integration is required.
- Do not change existing Supabase, Vercel, authentication, domain or production environment settings for this release.
- The checkpoint engine uses retained local/synthetic scorecard data. Its comparisons are operational evidence and do not prove causation.
- Coaching results do not make automated employment, disciplinary or compensation decisions.

## 5. Verification status

The included automated tests and syntax checks are recorded in `docs/TEST-RESULTS-v7.27.txt` and `docs/RELEASE-STATUS-v7.27.txt`. The supplied preparation workspace did not contain the full CALLORIA application repository or its installed production dependencies. A full Vite production build, live Vercel deployment, production browser session and physical-phone test were therefore not verified here.
