# CALLORIA v8.2 — Unified Workforce Cloud-History Integration

## Integration repair

- Added the v8.1 cloud history transformer as the eleventh member of the central workforce plugin suite.
- Defined its mandatory order after the v7.31 local history plugin.
- Extended the production integration gate to require the new plugin exactly once.
- Removed the separately registered v8.1 plugin from `vite.config.js` to prevent duplicate execution and split ownership.
- Updated the V8 integration audit to inspect the cloud plugin module, engine, CSS, migration and regression tests.
- Updated build preflight to fail early when any required cloud-history runtime or migration file is missing.
- Preserved the v8.0.1 static-import lexer repair and existing multi-page production entry contract.

## Preserved

- Existing recruitment and 3D workplace modules.
- Existing v7.22–v7.31 workforce and digital operations sequence.
- Existing Vite entry points and chat widget path.
- Existing Supabase tenant model, permission function and credentials.
- Existing v8.1 explicit sync, allow-list sanitisation, RLS reads and 90-snapshot retention behavior.

## Database

No new migration is introduced by v8.2. The v8.1 migration remains:

`supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql`

Check whether it has already been applied before running it. Never rerun it blindly.

## Verification

- Full overlay regression suite: 143 passed, 0 failed.
- JavaScript/MJS/CJS syntax checks: 49 passed.
- Cloud-history plugin transform, merge, retention, permission-contract, migration-contract and V8 ordering regression checks passed.
- Full Vite production build, live Supabase migration/RLS, cross-device sync, device gameplay and Vercel deployment were not run from this overlay workspace.
