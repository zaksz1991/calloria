# CALLORIA v8.9 — Recovery Checklist Portability

CALLORIA v8.9 extends the v8.8 Guided Cloud Recovery Checklist with a verified export/import path. A supervisor can carry recovery checklist ticks from one browser to another without copying the organisation's workforce history or making any Supabase changes.

## User-visible changes

The guided recovery area gains **Export checklist backup** and **Import checklist backup** controls. Export creates a JSON file containing only fixed remediation IDs and completed step indexes. Import verifies its checksum, organisation scope and exact checklist shape, then asks for confirmation before merging valid ticks with the current browser's progress.

## Safety contract

- The export contains no raw organisation ID, account/session data, database errors, employee/customer details, snapshots, customer transcripts or workforce history.
- The existing v8.8 organisation namespace is used as an accidental-mix-up guard. It is opaque, but it is not an authentication or security boundary.
- SHA-256 detects file corruption or modification; it does not prove that a file came from a trusted person.
- A different organisation scope or changed checklist shape is rejected.
- Existing checklist progress is merged, not replaced.
- Import changes only browser-local checklist ticks. It does not upload anything to Supabase.
- Checklist completion remains self-reported; the read-only cloud health check remains the source of truth for whether a repair worked.

## Files

- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `js/workforce-trend-cloud-recovery-portability-engine-v809.js`
- `styles/calloria-workforce-cloud-recovery-portability-v809.css`
- `tools/calloria-v89-recovery-portability-audit.mjs`
- `tests/workforce-trend-cloud-recovery-portability-v809.test.mjs`
- `tests/calloria-v89-recovery-portability-integration.test.mjs`
- Updated `vite.config.js`
- Updated `package.json`

This is an overlay for the existing CALLORIA repository, not a complete repository replacement. Preserve `.git`, `public/assets/`, GLB models, all existing source, Supabase configuration and local environment files.

## Validation

- 12 focused tests passed, 0 failed.
- JavaScript syntax checks passed for the engine, plugin, audit and test files.
- `package.json` JSON parsing passed.
- Full repository test suite, Vite production build, live Supabase behavior, browser UX and Vercel production deployment were not run in this environment.
