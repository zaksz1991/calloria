# Release status — CALLORIA v8.1

**Status:** Source overlay prepared; deployment and live database verification pending.

**Baseline checked:** Public `main` configuration registering the v8.0 workforce suite and production integration gate, the existing v7.31 trend-history transform and engine, and the existing CALLORIA cloud platform client/context.

**Primary change:** Explicit cloud synchronisation of aggregate workforce trend snapshots into a CALLORIA-prefixed, organisation-scoped Supabase table.

**Security model:** Existing CALLORIA organisation `reports:read` authorization; RLS-protected reads; writes through a security-definer allow-list sanitisation RPC; direct browser table writes revoked; 90-snapshot organisation retention.

**Deployment status:** Not pushed or deployed by this package preparation.
