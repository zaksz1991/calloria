# CALLORIA v8.7 — Guided Workforce Cloud Recovery

## Purpose

Turn the v8.6 read-only organisation workforce-history diagnostics into a guided recovery workflow. When a health check reports a warning or failure, the supervisor workspace now displays targeted next steps rather than leaving the operator with an error label alone.

## Changes

- Added a deterministic remediation-plan engine for the seven v8.6 health-check categories.
- Orders blocked conditions ahead of warnings.
- Provides distinct recovery guidance for workspace, authentication session, permissions, local history, organisation snapshot storage, conflict archive and backup-integrity failures.
- Adds per-issue copyable recovery instructions.
- Adds an explicit user-triggered Supabase session-refresh action for the `auth_session` warning only. A successful refresh automatically reruns the read-only health check.
- Keeps administrator-only SQL/RLS changes outside the browser. The package does not attempt to apply migrations, disable RLS, change roles, overwrite snapshots, resolve conflicts or restore backups automatically.
- Adds responsive remediation cards and focused build-integration checks.

## Privacy and safety

The remediation engine uses fixed, reviewed message templates keyed only by the fixed v8.6 check IDs and statuses. It does not copy free-form database error text, organisation IDs, employee identifiers or customer data into the runbook. Recovery instructions are rendered with `textContent`. Session refresh is initiated only when the user presses its button.

## Files

See `UPDATED-FILES.txt` for the exact replace/add list. This is an updated-files overlay, not a full repository archive.

## Configuration

No SQL migration, Edge Function, secret, Vercel environment variable, provider integration or dependency change is introduced.
