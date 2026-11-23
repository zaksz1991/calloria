# CALLORIA v8.12.1 — Integrated Recovery Build Gate

This is an integration and verification repair, not another gameplay feature.

## Corrections

- Restores the exact v8.6 `verify:workforce-cloud-health` npm script in the cumulative package manifest.
- Keeps the exact protected `prebuild` and `check` command strings and all pinned dependencies.
- Stabilises the shared v8.9 portability plugin name across the v8.9–v8.12 feature chain.
- Updates the older v8.9 integration test and audit to align with the protected Vercel build contract: the v8.9 audit runs through its dedicated verification command, not by changing `prebuild`.
- Adds one cumulative v8.9–v8.12 verification command and a build-time gate.
- Runs the cumulative regression gate from Vite `buildStart` only for `command === 'build'`; Vite development mode is unaffected.

## No infrastructure changes

No Supabase migration, Edge Function, secret, environment variable or dependency was added or modified. Existing Supabase configuration and the production Node 22/Vite contracts remain intact.
