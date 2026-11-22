# CALLORIA v8.0 — GUI Installation Guide

**Target repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Existing Vercel project:** `calloria`  
**Production URL:** `https://calloria.vercel.app`

## Package type

This is a cumulative v7.23–v7.31 feature-chain plus v8.0 integration overlay. It is not the complete CALLORIA application repository. It includes the current workforce modules and tests, the merged Vite configuration, package scripts and build-audit tools. It does not replace the core application, the complete `public/` asset collection, Supabase project or all historical source modules.

## Before installing

1. Make a backup copy of the existing local `calloria` repository folder.
2. Confirm the repository is on the `main` branch and there are no uncommitted changes that need preserving.
3. Keep the hidden `.git` folder, all `.env` files, the existing `public/assets/` and GLB models, all existing HTML pages, all Supabase files and all other application source folders.
4. Do not create a new GitHub repository or Vercel project.

## Install with GitHub Desktop and File Explorer

1. Download and extract `CALLORIA-v8.0-FULL-INTEGRATION-STABILISATION.zip` in File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the contents of the extracted `CALLORIA-v8.0` folder into the existing repository root. Do not copy an outer wrapper folder into the root.
5. Merge the `build`, `js`, `styles`, `tests` and `docs` folders. Allow the included v7.23–v7.31 modules/tests and the v8.0 files to be added or replaced.
6. Replace the complete `vite.config.js`, `package.json`, `README.md`, `CHANGELOG-v8.0.md` and `tools/calloria-build-preflight.mjs` with the included complete versions. Add `tools/calloria-v8-integration-audit.mjs`.
7. Preserve the existing `tools/calloria-navigation-integrity-audit.mjs` and `tools/calloria-build-artifact-audit.mjs`. The updated package scripts call both of them.
8. Keep the existing `.nvmrc` Node 22 pin, `vercel.json`, `package-lock.json`, `supabase/`, environment files, GLB files and public assets. v8.0 changes no dependencies, so do not delete or regenerate the lockfile.
9. In GitHub Desktop, review the changed-file list. Confirm the v8 files and the updated `vite.config.js`, `package.json`, preflight, tests and documentation are present. Confirm no core application page, Supabase file, GLB or `.git` folder has been deleted.
10. Commit to `main` with the summary `CALLORIA v8.0 — full integration and production stabilisation`, then select **Push origin**.

## What the next Vercel build now checks

The existing Vercel project should continue to use:

- Framework: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x

The updated `prebuild` runs the build preflight, existing navigation integrity audit and new v8 integration audit before Vite compiles the application. The Vite integration gate then checks plugin order and all 20 HTML entries plus the chat widget. The existing post-build artifact audit still runs after Vite.

No new Vercel environment variable or Supabase setting is required. Do not change credentials, RLS policies, database migrations or Edge Functions for this release.

## Acceptance checks after a successful deployment

1. Confirm Vercel reports a successful production deployment. A passing offline test suite alone is not a deployment result.
2. Open the production site on desktop and mobile and confirm the landing page and guest entry still load.
3. Enter the workplace and test the existing recruitment/application gate, employed-agent path and shift start.
4. Open each existing operations entry: Customer Care, Case Desk, Customer 360, Agent Desk, Workforce, Performance, Sales Desk, Support Router, Routing Control, Voice Simulator, WhatsApp Inbox, Email Inbox, Live Chat Inbox, Social Inbox, Voice Console, SMS Inbox, Operations Intelligence, Knowledge Operations and Asset Inspector.
5. Open the workforce/supervisor area and confirm the follow-up, coaching, coaching-outcome, sustainment, career-evidence, workforce-intelligence, command-centre and trend-history panels are present.
6. Check that historical trend capture remains browser-local and that no employee identifier, customer record or transcript appears in aggregate trend exports.
7. Enter the 3D workplace and verify that actual GLB assets load. Do not treat a successful HTML build as proof that remote model requests or physical mobile touch controls work.
8. Re-test the recruitment-to-first-shift-to-customer-interaction-to-wrap-up flow on a phone and desktop browser.

## Verification status at package creation

- 127 focused v7.23–v7.31 + v8.0 regression tests passed.
- 43 JavaScript files passed `node --check`.
- Source-audit fixture tests passed, including missing-plugin, duplicate-plugin, wrong-order, missing-entry and missing-output cases.
- The full project `npm test`, production Vite build, browser end-to-end run, Supabase remote state and Vercel deployment were not run in the package-preparation workspace. The working copy contained the feature-chain overlay, not the complete original repository or installed dependencies.

Treat v8.0 as production-stable only after the full Vercel build and the browser acceptance checks above pass.
