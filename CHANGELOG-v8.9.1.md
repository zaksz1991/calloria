# CALLORIA v8.9.1 — Vercel Build Contract Repair

## Fixed
- Restored the exact `prebuild` and `check` script values required by the repository build preflight.
- Moved the v8.9 release-specific audit into the dedicated `verify:workforce-cloud-recovery-portability` command, after the focused tests.
- Kept the Node 22 engine requirement and all pinned runtime/build dependencies unchanged.

## Scope
This is a build-contract repair for v8.9. It does not change the checklist portability runtime, Vite plugin registration, Supabase schema, environment variables or dependencies.
