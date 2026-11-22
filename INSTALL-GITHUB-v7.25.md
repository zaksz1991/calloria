# CALLORIA v7.25 — GUI Installation Guide

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Existing Vercel project:** `calloria`  
**Production domain:** `https://calloria.vercel.app`

## Package boundary

This is a cumulative v7.23 + v7.24 + v7.25 upgrade overlay, not a full copy of the entire CALLORIA repository. It contains the supervisor follow-up watch, response performance scorecards, the new coaching workflow, their required engine/plugin files, tests, styles and the updated root `vite.config.js`.

It does not contain the whole game, the full `public/` directory, `.git`, the repository's `package.json`, environment files or the binary `public/assets/` GLB models. Keep those from the existing repository.

## Install with GitHub Desktop and File Explorer

1. Back up the current local `calloria` repository folder.
2. Extract `CALLORIA-v7.25-DIGITAL-FOLLOWUP-COACHING.zip` in File Explorer.
3. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the archive's `build`, `js`, `styles`, `tests` and `docs` folders into the existing repository root. Allow the included v7.21–v7.25 follow-up files to be added or replaced.
6. Replace the existing root `vite.config.js` with the one in this archive. It preserves the existing 3D, OJT, mobile, digital experience and multi-page registrations, then adds v7.23, v7.24 and v7.25 in order.
7. Do **not** replace `package.json`. Do not delete `.git`, `public/`, `public/assets/`, GLB models, app pages, local environment files or any existing project files.
8. Confirm these files are present:
   - `build/calloria-digital-followup-supervisor-v723.mjs`
   - `build/calloria-digital-followup-performance-v724.mjs`
   - `build/calloria-digital-followup-coaching-v725.mjs`
   - `js/digital-response-cycle-engine-v721.js`
   - `js/digital-followup-supervisor-engine-v723.js`
   - `js/digital-followup-performance-engine-v724.js`
   - `js/digital-followup-coaching-engine-v725.js`
   - matching v7.23/v7.24/v7.25 styles and tests
   - updated root `vite.config.js`
9. Review the complete changed-file list in GitHub Desktop. Commit with `CALLORIA v7.25 — digital follow-up coaching plans`, then select **Push origin**.
10. Keep the current Vercel project, build settings and environment variables. Do not change Supabase configuration. Confirm Vercel reports a successful production deployment before treating v7.25 as live.

## Where the upgrade appears

Open CALLORIA, use an employed profile, start a shift, then open the **Supervisor** workspace. The new **Digital follow-up coaching** panel appears above the existing follow-up performance and SLA watch panels.

A supervisor can create a plan from an evidence-backed recommendation, start the plan, and mark it completed. An open or in-progress plan suppresses duplicate recommendations for that agent.

## Acceptance checks

1. Use a synthetic agent with at least one overdue follow-up. Confirm a recovery recommendation includes the overdue count and practice objective.
2. Create the coaching plan. Confirm it appears in Plan tracker and the duplicate recommendation disappears.
3. Start the plan. Confirm status changes to **IN PROGRESS**.
4. Mark it completed. Confirm it moves out of active plans and appears in completed-plan counts.
5. Use an agent with at least three completed cycles and a response-target rate below 85%. Confirm a measurable rate-improvement recommendation appears.
6. Confirm healthy agents and agents with insufficient completed samples do not receive response-rate recommendations.
7. Check the layout at desktop and phone widths.
8. Confirm the existing v7.23 SLA watch and v7.24 scorecards still appear and operate.

## Configuration and limitations

- No Supabase SQL migration, Edge Function, external API, new secret, environment variable or npm dependency.
- No GLB or other binary asset change.
- Coaching plans are attached to the existing local game state and saved through the existing `saveState()` path. They are local simulation records, not a shared multi-user HR workflow.
- The automated release tests and syntax checks passed in the preparation environment. A full Vite production build, full repository suite, browser end-to-end session, Vercel deployment and real-device visual check were not run here.
