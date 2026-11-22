# CALLORIA v8.1 database migration

Apply `202611220001_calloria_workforce_trend_cloud_history.sql` once in the existing shared Supabase project, after CALLORIA tenancy migration `202611070001_calloria_server_tenancy.sql` is already present.

The migration:

- Creates only the CALLORIA-prefixed `calloria_workforce_trend_snapshots` table and helper/RPC/trigger functions.
- Uses the existing `organizations`, `organization_memberships`, `has_calloria_org_permission` and Supabase Auth objects created by CALLORIA's tenancy foundation.
- Restricts reads to authenticated organisation members with `reports:read`.
- Restricts writes to the authenticated `calloria_save_workforce_trend_snapshots` RPC; direct table writes are revoked.
- Rebuilds each snapshot from a strict aggregate-only allow-list, discarding extra keys such as employee IDs, customer details, case references, transcripts and notes.
- Keeps at most 90 snapshots per organisation.
- Does not create or expose a service-role credential and does not alter RuffNeck Prospector-specific tables.

No Edge Function deployment or new Vercel variable is required. The browser uses the existing authenticated CALLORIA Supabase client and existing publishable/anon key. Do not rerun earlier migrations.
