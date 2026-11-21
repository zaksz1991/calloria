# CALLORIA v6.86 — cumulative workplace repair and RuffNeck service-operations rebase

**Repository:** `zaksz1991/calloria`  
**Production site:** `https://calloria.vercel.app/`  
**Source audit:** current public `main` structure inspected on 21 November 2026; the Vercel failure log supplied for this repair came from commit `393dbd9`.  
**Release type:** cumulative targeted overlay, not a complete repository export.

## What this release addresses

1. Carries forward the v6.84 non-blocking GLB workplace startup repair.
2. Carries forward the v6.85 third-person/workstation plugin repair for the current `production-world.js` readiness sequence. This is the fatal transform reported by the supplied Vercel log.
3. Replaces the stale v6.51–v6.54 RuffNeck support plugin chain with one v6.86 source-aware transform. The build log showed the old chain skipping because its expected `main.js` anchors no longer existed.
4. Replaces the simulated Workforce system directory. RuffNeck products are included; Finacle is removed. FirstMobile, USSD and Postilion remain labelled as optional banking-industry systems.

## Install using GitHub Desktop and File Explorer

1. Back up the current CALLORIA repository folder.
2. Extract this ZIP.
3. Open `zaksz1991/calloria` in GitHub Desktop. Select **Repository → Show in Explorer**.
4. Copy the extracted release contents into the repository root and preserve the folder structure. Replace the matching files listed below.
5. Merge the included `tests` folder into the repository's existing `tests` folder. Do not delete unrelated tests.
6. Review the changed-file list in GitHub Desktop. Commit the changes with:

   `CALLORIA v6.86 — cumulative GLB repair and RuffNeck support rebase`

7. Push to `main`. Check the Vercel deployment result and inspect the first complete build log.

### Runtime files to replace or add

| Repository path | Action |
|---|---|
| `vite.config.js` | Replace. Removes the obsolete v6.51–v6.54 plugin registrations and registers the single v6.86 plugin. Retains the existing third-person and GLB plugin registrations. |
| `build/calloria-glb-world-plugin.js` | Replace with the cumulative v6.84 non-blocking startup repair. |
| `build/calloria-third-person-player-plugin.mjs` | Replace with the v6.85 current-world transform repair. |
| `build/calloria-ruffneck-service-operations-v6-86.mjs` | Add. New consolidated RuffNeck service-operations transform. |
| `js/glb-asset-health-panel.js` | Replace with the cumulative v6.84 accurate loading/failure diagnostics. |
| `js/glb-asset-path-fallback.js` | Add or replace with the supplied runtime path fallback dependency. |

### Required existing dependency — do not delete

Keep this existing file from the repository:

`build/calloria-ruffneck-platform-support-v6-51.mjs`

The new v6.86 module imports its service catalogue as data. It is no longer registered as a separate Vite plugin. The old v6.52, v6.53 and v6.54 plugins are also no longer registered in the supplied `vite.config.js`.

### Preserve all unrelated project content

Do not replace or delete `.git`, `public/assets/`, GLB model binaries, environment files, package files, Supabase configuration, Edge Functions, HTML entry pages, or other existing build plugins. This release adds no new npm package, environment variable, Supabase migration or Edge Function.

## v6.86 service-operations changes

- Adds support playbooks and self-service checks for RuffNeck LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke.
- Adds scored service-practice scenarios.
- Adds synthetic support cases with service/request validation, specialist routing, named ownership, assignment history, status updates and resolution notes.
- Adds priority targets: Low 48 hours, Normal 24 hours, High 2 hours and Critical 30 minutes. Critical cases are escalated immediately; other unresolved cases are escalated by the in-game SLA clock.
- Mirrors the synthetic support case into the existing simulated CRM case list and labels its QA score as not applicable rather than treating it as a reviewed call.
- Redacts common passwords, OTPs, emails, phone numbers and long numeric identifiers in case descriptions.
- Sets the new applicant path to Customer Experience / Customer Service Associate. A narrow migration changes only a blank, unsubmitted legacy banking applicant profile; named or submitted applications are not rewritten.
- Uses the current `simulationDateNow()` clock for SLA deadlines. The saved CALLORIA profile may sync through the existing cloud-employment sync when that feature is enabled.

These are training records only. The feature does not log in to RuffNeck products, read their production databases, access live customer accounts, or perform payments or other live transactions.

## Post-deployment checks

1. Confirm the Vercel build gets past the former `combined GLB-ready callback anchor (0 found)` error.
2. Open the workplace on a phone and verify that the local scene and touch controls appear before GLB downloads finish.
3. Open the GLB diagnostics panel and distinguish pending downloads from settled failures. Confirm actual GLB counts only after both loaders settle.
4. Open Workforce. Confirm the RuffNeck service directory and synthetic case desk are visible.
5. Open one practice scenario and submit a response. Confirm the score and feedback are recorded.
6. Create a case using a `CUS-SIM-...` reference, select a priority and submit. Confirm the case appears in the case list and simulated CRM, with specialist ownership and an SLA deadline based on the in-game clock.
7. Confirm the three banking-specific systems remain optional and Finacle no longer appears.

The packaged regression tests do not replace these live browser and mobile checks.
