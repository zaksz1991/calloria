# CALLORIA v7.24 — GUI Installation Guide

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Existing Vercel project: `calloria`  
Production URL: `https://calloria.vercel.app`

## Important package boundary

This archive is a cumulative v7.23 + v7.24 source overlay, not a complete copy of the entire repository. It includes the v7.23 supervisor follow-up panel, the v7.24 performance scorecard, their shared v7.21 response-cycle engine, tests, styles and a complete Vite configuration file. It does not include the rest of the app or binary `public/assets/` GLB models.

## Install with GitHub Desktop and File Explorer

1. Back up the existing local `calloria` repository folder.
2. Extract `CALLORIA-v7.24-DIGITAL-FOLLOWUP-PERFORMANCE.zip` in File Explorer.
3. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the archive's `build`, `js`, `styles`, `tests` and `docs` folders into the existing repository root. Allow the included v7.23/v7.24 files to be added or replaced.
6. Replace the existing root `vite.config.js` with the one in this archive. It retains the v7.22 and v7.23 registrations and adds v7.24 after v7.23.
7. Do not delete the hidden `.git` directory. Preserve `public/assets/`, every existing GLB model, existing app folders, `package.json`, environment files, Vercel settings and Supabase configuration.
8. Confirm these key files exist:
   - `build/calloria-digital-followup-supervisor-v723.mjs`
   - `build/calloria-digital-followup-performance-v724.mjs`
   - `js/digital-response-cycle-engine-v721.js`
   - `js/digital-followup-supervisor-engine-v723.js`
   - `js/digital-followup-performance-engine-v724.js`
   - `styles/calloria-digital-followup-supervisor-v723.css`
   - `styles/calloria-digital-followup-performance-v724.css`
   - both v7.23 and v7.24 test files
   - updated `vite.config.js`
9. Review the complete changed-file list in GitHub Desktop. Commit with `CALLORIA v7.24 — digital follow-up performance scorecards`, then select **Push origin**.
10. Confirm the existing Vercel project reports a successful production deployment before treating v7.24 as live.

## What changes in the game

Open the **Supervisor** workspace after starting a shift. The existing **Digital follow-up SLA watch** remains. A new **Digital follow-up performance** panel appears above it, showing overall target performance and per-agent follow-up response scorecards. Email, live chat and social metrics remain separated.

## Acceptance checks after deployment

1. Use an existing employed profile and start a shift.
2. Accept a digital contact, send an agent reply and receive the scripted customer follow-up.
3. Reply to that customer follow-up. Confirm the completed follow-up cycle appears in the scorecard and is attributed to the responding agent ID.
4. Create another follow-up cycle and leave it unanswered. Confirm it is grouped under the contact's current assigned owner and appears as open/at-risk/overdue according to its channel SLA.
5. Check that the target-met rate uses completed cycles only; open work must not lower the completed response rate.
6. Check email, live-chat and social channel counts separately.
7. Verify the desktop and phone layout. The agent scorecards should stack on narrow screens without page-wide horizontal overflow.

## Configuration and verification

- No SQL migration or Edge Function deployment.
- No new Vercel environment variable or secret.
- No new npm dependency.
- No GLB or other binary asset change.
- The supplied focused tests validate the scorecard engine and Vite transform. A full Vite build, full repository test suite, Vercel deployment and real-device visual check are not performed by preparing this archive.
