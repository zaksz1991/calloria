# CALLORIA v7.29 — Workforce Performance Intelligence

This cumulative source overlay extends the v7.23–v7.28 Supervisor chain with a source-labelled, read-only workforce intelligence panel.

## What is integrated

For the current local employee profile, the board shows inbound and outbound voice volume, resolution rate, average handle time, QA score and sample count, customer satisfaction and sample count, shift adherence, incident-register indicators, and the exact-match digital follow-up scorecard where the employee ID matches.

For the wider digital queue, it keeps the attributed digital-agent scorecards separate and shows completed replies, target achievement, overdue and at-risk work. It links to v7.28 career readiness only when that agent has the matching career dossier.

The Service Evidence Index weights available QA (30%), CSAT (25%), digital response-target rate (25%) and shift adherence (20%). At least two dimensions are required. Its coverage percentage shows which weights contributed. Missing evidence is unscored.

## Important boundaries

This is not a verified organisation-wide workforce dashboard. Voice, QA, CSAT, shift and incident values come from the current local employee profile. Other digital agents remain digital-only unless each channel records the same employee identifier. Shift adherence is not biometric attendance. The index is not a promotion score or HR decision. The panel does not connect to an external ACD, payroll, biometric attendance platform or HRIS.

No data is written by this panel. It does not change employee status, pay, role, promotion eligibility, promotion attempts, coaching plans or career review decisions.

## New files

- `js/workforce-intelligence-engine-v729.js`
- `build/calloria-workforce-intelligence-v729.mjs`
- `styles/calloria-workforce-intelligence-v729.css`
- `tests/workforce-intelligence-v729.test.mjs`
- `tests/vite-config-v729.test.mjs`

`vite.config.js` is updated to register v7.29 after v7.28. The archive retains the v7.23–v7.28 overlay files and their tests/docs. It is not the complete CALLORIA application repository and does not contain the private `.git` directory or `public/assets/` GLB binaries.

## Validation

See `docs/TEST-RESULTS-v7.29.txt`. Full Vite production build, GitHub push, Vercel deployment and physical-device browser verification have not been performed in this workspace.

## Installation

Follow `INSTALL-GITHUB-v7.29.md`. Preserve the current repository, `.git`, `public/assets/`, GLB models, local environment files, credentials and unrelated application files.
