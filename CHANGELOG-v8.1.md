# CALLORIA v8.1 — Organisation Workforce Trend Sync

## Why this release exists

v7.31 stores aggregate workforce snapshots in browser localStorage only. That history is tied to one browser profile and is not available to another authorised member or device. v8.1 adds an explicit, organisation-scoped Supabase sync path without silently uploading guest history.

## Delivered

- Supervisor users can explicitly save local aggregate snapshots to their active CALLORIA organisation.
- Authorised organisation members can load the last 90 cloud snapshots and merge them with local browser history.
- Merge is timestamp-deduplicated; local snapshots take precedence on an identical timestamp.
- The cloud table stores only aggregate channel and department measures. The database RPC rebuilds payloads from an allow-list and discards unknown keys, employee identifiers, customer details, case references, transcripts and notes.
- Reads require the existing `reports:read` organisation permission. Writes require the same permission through a security-definer RPC; direct table writes are revoked.
- A database trigger retains no more than 90 snapshots per organisation.
- Guest play and local-only history remain available without sign-in. No automatic cloud upload occurs.
- The current Vite multi-page inputs and v8.0 ordered workforce suite are preserved. The new plugin is registered after the v8 production integration gate and v7.31 transform chain.

## Database

Apply `supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql` once. It requires the existing CALLORIA tenancy foundation (`202611070001_calloria_server_tenancy.sql`) to be present. It creates only `calloria_` prefixed objects and does not alter shared Prospector tables.

No Edge Function deployment, new Vercel variable, new dependency or service-role key is required.

## Verification boundary

The 12 focused pure-engine, Vite-plugin, migration-contract and UI tests pass; six JavaScript/MJS syntax checks and the injected main-module syntax check pass. Package JSON parsing, SQL static security/schema assertions and ZIP integrity checks also pass. The full repository Vite build, live SQL execution, live Supabase RLS/permission checks, live cross-device sync and Vercel deployment are not run from this package-preparation environment. Do not treat local source tests as proof of a production deployment.
