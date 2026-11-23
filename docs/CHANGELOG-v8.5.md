# CALLORIA v8.5 — Verified Workforce History Recovery Backup

## Purpose

Adds a portable recovery backup for the organisation workforce trend history introduced in v8.1 and hardened in v8.3–v8.4. This is an additive overlay containing only files created or changed for v8.5.

## Changes

- Adds a JSON recovery backup containing browser-local trend history, organisation trend snapshots and retained conflict-archive evidence.
- Adds an organisation fingerprint so a backup can be checked against the currently active organisation without exporting the raw organisation UUID.
- Adds a SHA-256 checksum over a canonical JSON representation to detect accidental file changes or corruption.
- Validates schema, version, timestamps, duplicates, approved aggregate snapshot fields, conflict rows and a 12 MiB input limit before restore.
- Rejects archives with more than 90 conflict records instead of silently truncating evidence.
- Adds browser-local restore with deterministic merge precedence: current browser values win, followed by backup-local values, then archived variants and organisation snapshots.
- Keeps restore separate from cloud synchronisation. Importing a backup never writes to Supabase; after reviewing the restored local history, an authorised user may separately invoke the existing cloud-save action.
- Adds preflight and integration-audit requirements for the recovery engine and tests.

## Security and data boundaries

- Exported trend snapshots contain approved aggregate workforce metrics only. No employee identifiers, customer identifiers, conversation text, credentials or raw organisation UUID are exported.
- The organisation fingerprint is a one-way SHA-256 digest of the organisation UUID under a CALLORIA-specific context string. It is a scope check, not authentication.
- The SHA-256 checksum detects accidental corruption and unsophisticated edits. It is not a digital signature and does not prove who created a backup or prevent a determined editor from recalculating the checksum.
- The restore function accepts only an object returned by a successful verification call in the current JavaScript module instance.
- Restoring updates browser-local trend history only. It does not modify organisation history or conflict archive rows.

## Database and deployment

- No new Supabase migration is introduced.
- No new Edge Function, API key, Vercel environment variable or npm dependency is introduced.
- The existing v8.1–v8.4 workforce history tables and migrations must already be installed for export of organisation history and conflict evidence.
- The central Vite plugin suite order is unchanged; the existing cloud-history plugin is upgraded in place.
