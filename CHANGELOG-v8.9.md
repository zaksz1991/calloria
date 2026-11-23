# CALLORIA v8.9 — Recovery Checklist Portability

## Added

- Export checklist progress from the organisation's active recovery plan as a small JSON backup.
- Import checklist progress on another browser/device after validating the file.
- SHA-256 integrity verification using the browser Web Crypto API.
- Organisation-scope check using the existing opaque v8.8 storage namespace; raw organisation IDs are not exported.
- Exact checklist-shape check prevents stale step indexes from being applied to a changed runbook.
- Explicit confirmation before import; valid imported ticks are merged with existing local progress rather than replacing it.
- A 256 KiB file-size limit and rejection of malformed, altered, unsupported or cross-organisation files.
- Responsive controls and a v8.9 release audit included in the Vercel prebuild gate.

## Preserved

- Existing v8.1–v8.8 cloud history, conflict review, diagnostics, guided remediation and local progress behavior.
- Supabase schemas, RLS, migrations and Edge Functions.
- Existing Vercel/Supabase secrets and environment variables.
- Node 22, Vite 6.4.5, Three.js 0.170.0 and Supabase JS 2.119.0 pins.

## Not included

- No SQL migration or database write for checklist backups.
- No automatic cloud upload of checklist progress.
- No changes to employee, customer or workforce trend records.
- No new dependencies or secret values.
