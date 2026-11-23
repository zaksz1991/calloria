# CALLORIA v8.5.1 — Workforce Cloud Plugin Dependency Repair

## Vercel failure addressed

The deployment at commit `8c01abc` stopped in `prebuild` with one v8 integration-audit issue:

`The organisation cloud-sync plugin must load the v8.4 durable conflict-review engine.`

The v8.5 replacement of `build/calloria-workforce-trend-cloud-sync-v801.mjs` retained the v8.5 recovery-backup engine import but accidentally removed the direct v8.4 conflict-review engine import that the v8 integration audit requires. The transformed `main.js` still injected the v8.3 engine import, but that did not satisfy the explicit plugin dependency contract checked by the audit.

## Repair

- Restores the direct static dependency on `js/workforce-trend-cloud-sync-engine-v803.js`.
- Retains the v8.5 recovery-backup dependency on `js/workforce-trend-backup-engine-v805.js`.
- Adds a version guard requiring the v8.4 durable conflict engine version `8.4.0` before the plugin is created.
- Adds regression tests for both direct dependencies and the transformed `main.js` import wiring.
- Leaves the central Vite plugin order, Supabase schema, SQL migrations, package dependencies and Vercel configuration unchanged.

## Scope

Updated files only. No new feature, database migration, secret, Edge Function, package dependency or environment variable.
