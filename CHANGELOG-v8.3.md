# CALLORIA v8.3 — Cloud History Conflict Guard

## Purpose

Make organisation-wide workforce trend synchronisation non-destructive when two browser histories contain different aggregate snapshots with the same capture timestamp.

## Changes

- Adds `inspectWorkforceTrendCloudConflictsV802` to compare validated local and organisation snapshots.
- Displays conflict-aware success, warning and error states in the existing trend history panel.
- Uses a detailed synchronisation RPC that returns inserted, unchanged and conflicting snapshot counts.
- Makes the legacy v8.1 save RPC conflict-safe for older clients: an identical retry remains idempotent; a different snapshot at an existing timestamp is rejected instead of overwriting the organisation copy.
- Keeps local-wins merge behaviour, but reports same-timestamp differences before the merge and warns users to export local history before clearing browser storage.
- Extends the production integration audit and build preflight to require the v8.3 engine, migration and regression test.
- Updates the focused cloud-history verification command.

## Database

New migration: `202611220002_calloria_workforce_trend_conflict_guard.sql`.

It creates no table, changes no existing snapshot, and uses the existing organisation permission function and v8.1 snapshot normaliser. Apply once after migration 001. No Edge Function, secret, Vercel setting or package dependency is added.

## Verification boundary

The focused v8.1/v8.3, plugin-transform and v8 integration regression tests pass in the release workspace. The SQL migration was checked by static contract tests but was not executed against PostgreSQL/Supabase. A complete Vite production build and live Supabase multi-user test have not been performed.
