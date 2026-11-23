# CALLORIA v8.9.1 — Vercel Build Contract Repair

The v8.9 deployment stopped during `npm install` because its `package.json` had appended a release-specific audit to the centrally validated `prebuild` and `check` scripts. The build preflight intentionally requires exact script values.

This overlay restores those exact values and places the v8.9 audit after the focused v8.9 tests in `verify:workforce-cloud-recovery-portability`. The Vercel build contract, dependency pins and Node 22 requirement are preserved.

No runtime application logic, Supabase migration, Edge Function, environment variable or dependency is changed.
