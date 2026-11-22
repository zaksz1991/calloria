# CALLORIA v7.28 — Workforce Career Evidence Bridge

This release links the v7.23–v7.27 digital follow-up supervision, agent scorecards, coaching, outcome reviews and sustainment checks to a supervisor career-review dossier.

## What it does

For each agent in the retained synthetic Email, Live Chat and Social follow-up scorecard, the Supervisor workspace displays a readiness status, evidence score, completed response count, response-target rate, overdue and at-risk work, coaching status and 30-day sustainment status.

A career review packet can only be prepared when the configured evidence gates are met. The supervisor must record a named decision and supporting notes. Decisions are to refer to the existing formal promotion-exam eligibility review, defer for continued development, or not recommend at this review.

The new workflow does not promote anyone, award compensation, change job title, modify employment status, or consume a promotion exam attempt. Formal progression remains subject to CALLORIA's existing performance eligibility rules, annual examination process and three-attempt limit.

## New files

- `js/digital-career-evidence-engine-v728.js`
- `build/calloria-digital-career-evidence-v728.mjs`
- `styles/calloria-digital-career-evidence-v728.css`
- `tests/digital-career-evidence-v728.test.mjs`
- `tests/vite-config-v728.test.mjs`

## Installation

Follow `INSTALL-GITHUB-v7.28.md`. This ZIP is an overlay, not the complete repository. It expects v7.23–v7.27 to be merged first. Keep `.git`, `public/assets/`, GLB models, environment files, credentials and unrelated source files.

## Validation

- Automated tests: 76 passed, 0 failed.
- JavaScript/MJS syntax: 25 files passed.
- Generated Vite-transformed `main.js` syntax: passed.
- Full Vite production build: not run; the complete repository and installed dependencies were not available in this preparation workspace.
- Live Vercel deployment and production browser/device behaviour: not verified.

No SQL migration, Edge Function, secret, environment variable, provider integration or dependency is added.
