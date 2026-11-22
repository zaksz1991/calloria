# CALLORIA v7.26 — GUI installation

Target repository: `zaksz1991/calloria`  
Production branch: `main`  
Production site: `https://calloria.vercel.app`

## Release type

This is a cumulative v7.23–v7.26 digital follow-up overlay. It is not a complete copy of the CALLORIA repository. It contains the prior v7.23–v7.25 modules plus the v7.26 coaching outcome review module and a Vite configuration snapshot from the v7.25 baseline.

## Before copying

1. Make a backup copy of your current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` directory. Do not delete it or replace the repository with the extracted ZIP.
5. Preserve `public/assets/`, all GLB models, local environment files and any other files not listed in this release.

## Merge the release files

1. Extract `CALLORIA-v7.26-DIGITAL-FOLLOWUP-COACHING-OUTCOMES.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.26` folder.
3. Merge the `build`, `js`, `styles`, `tests` and `docs` folders into the matching folders in the existing repository. Allow the listed same-name release files to be added or replaced. Do not remove unrelated files.
4. Copy the root `CHANGELOG-v7.26.md`, `README.md` and `INSTALL-GITHUB-v7.26.md` into the repository root if you keep release documentation there.
5. Review `vite.config.js` before replacing it. The supplied file carries the v7.25 Vite configuration snapshot and adds the v7.26 import/registration. **Use it as a complete replacement only if your current file is still the v7.25 baseline.**
6. If the current Vite config contains later project changes, keep that file and merge only these two v7.26 additions, ensuring the plugin runs immediately after the v7.25 coaching plugin:

   Import alongside the other CALLORIA plugin imports:

   `import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from './build/calloria-digital-followup-coaching-outcomes-v726.mjs';`

   In the `plugins` array immediately after `calloriaDigitalFollowUpCoachingPluginV725()`:

   `calloriaDigitalFollowUpCoachingOutcomesPluginV726(),`

7. Confirm that the Vite plugin registrations for v7.23, v7.24, v7.25 and v7.26 are all present and in that order.
8. Return to GitHub Desktop and inspect the changed-file list. Confirm no unrelated files were deleted and that `public/assets/` and GLB models remain untouched.
9. Commit with message `CALLORIA v7.26 — digital follow-up coaching outcome reviews` and push to `main`.
10. Open the existing CALLORIA Vercel project and confirm the deployment for the new commit completes successfully. Do not change the Vercel project, root directory, build settings, Supabase settings or environment variables for this release.

## In-game acceptance checks

1. Open the Supervisor workspace with a profile that has access to synthetic digital operations.
2. Create a v7.25 coaching plan from a current agent scorecard.
3. Start and complete the plan using its existing controls.
4. Confirm the completed plan appears in **Coaching outcome reviews**.
5. Confirm the panel shows the same agent and compares the current follow-up metric with the plan baseline and target.
6. Select **Record outcome review** once. Confirm the status and review date appear and the action is no longer offered for that plan.
7. Confirm an operation-timeline event records the outcome review.
8. Repeat with overdue recovery, at-risk prevention and response-target consistency. The response-rate outcome requires at least three completed follow-up cycles.
9. On mobile width, confirm metric cards wrap into two columns and the review button expands to the available row width.

## Database, credentials and deployment boundaries

- No Supabase SQL migration is required.
- No Edge Function deployment is required.
- No new secret, API key, environment variable or provider connection is required.
- No package dependency is added.
- The feature uses the existing local simulated scorecard and coaching-plan state. It is not a new cloud-sync feature.

## Verification boundary

The release preparation suite passed 49 tests and source syntax checks. A complete project Vite build, production deployment, browser end-to-end session and physical-phone check were not run. The ZIP is not the full CALLORIA repository; production success must be confirmed by the existing Vercel deployment result.
