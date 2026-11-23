# CALLORIA v8.12.3 — Migration-Neutral Recovery Release Guard

## Change

The cumulative production integration gate now runs a migration-neutrality regression test. It runs the corrected v8.11 handover verifier in isolated repository fixtures both with and without a `supabase/migrations/` directory.

The populated fixture contains existing CALLORIA and shared-product SQL migration files. The test confirms that the verifier passes, does not create or delete migration files, and does not alter their contents.

## Included continuity repair

The v8.12.2 correction to `tests/calloria-v811-recovery-handover-verification-integration.test.mjs` is included in this overlay. It removes the invalid assumption that a production repository must not contain Supabase migrations.

## Protected contracts

- Exact `preinstall`, `prebuild`, `build`, `postbuild` and `check` scripts are not changed.
- Node remains pinned to `22.x`.
- Vite, Three.js, Supabase JS and esbuild dependency pins are not changed.
- No database migration is added or applied.
- Existing migrations and Supabase objects are not modified.
- No Edge Function, secret or Vercel environment variable is added.

## Verification

The cumulative v8.9–v8.12 recovery gate passed locally with 52 tests and the dedicated v8.9 portability audit. The full repository Vite build and Vercel deployment have not been verified by this package.
