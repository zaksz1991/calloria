# CALLORIA v8.0 — Full Integration and Production Stabilisation

## Changes

- Replaced nine separate v7.23–v7.31 Vite registrations with one central `calloriaWorkforceDevelopmentSuitePluginsV8()` registration group.
- Kept the v7.22 digital experience suite first, followed by supervisor follow-up monitoring, follow-up performance, coaching, coaching outcomes, 7-/30-day sustainment checkpoints, career evidence, workforce intelligence, the workforce command centre and workforce trend history.
- Added a fail-fast Vite integration gate. It checks plugin presence, uniqueness and order, the existing 20 HTML entries, the public chat-widget source, and emitted HTML/widget outputs.
- Added `tools/calloria-v8-integration-audit.mjs` to check the source import graph, build entry files, package scripts, Node 22 pin, pinned dependencies and Vercel build/output settings.
- Added the integration audit to `prebuild`, `check` and `verify:integration`; preserved the existing preinstall and post-build artifact safeguards.
- Reworked the v7.23–v7.31 Vite config regression tests so they assert the consolidated v8 registration rather than expecting each plugin to be separately listed in `vite.config.js`.

## Preserved

- All feature engines, stylesheets and tests from v7.23–v7.31.
- Earlier 3D, OJT, career, service-operations, public-experience and Try-It Studio Vite plugins.
- All 20 HTML input pages and the `widgets/calloria-chat.js` output contract.
- Existing Vite/Three/Supabase/esbuild dependency versions and Node 22 runtime pin.
- Vercel `npm run build` / `dist` contract.

## No external configuration change

No Supabase migration, Edge Function, API key, secret, environment variable, provider account, new dependency or customer-data migration is required.

## Verification

- Focused v7.23–v7.31 + v8.0 tests: 127 passed, 0 failed.
- JavaScript syntax: 43 files passed.
- Integration-audit success/failure fixtures: passed.
- Full Vite production build: not run (the supplied workspace is an overlay without the complete base repository and installed `node_modules`).
- Vercel deployment and physical desktop/mobile testing: not run.
