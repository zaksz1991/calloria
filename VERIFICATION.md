# Phase 21 verification report

## Passed

- Full included Phase 20 + Phase 21 Node test suite: **168 passed, 0 failed**.
- Phase 21 focused tests: **19 passed, 0 failed**.
- `node --check js/knowledge-operations-engine.js`: passed.
- `node --check js/knowledge-operations-workbench.js`: passed.
- `tsc -p tsconfig.edge.json --pretty false`: passed, including the new `calloria-knowledge-operations` Edge Function.
- Knowledge page HTML parsed; **67 IDs**, no duplicate IDs.
- All 62 static DOM selectors in the new workbench resolve to an HTML element.
- Knowledge page JavaScript and CSS local paths exist.
- `package.json`, `tsconfig.edge.json` and `supabase/config.toml` parse successfully.
- Phase 21 Vite input, staff navigation and new Edge Function configuration are present.
- Migration static checks confirm isolated `calloria_km_*` tables, RLS, browser privilege revocation, service-role-only publication functions and no destructive changes to shared Prospector tables.
- Atomic publish/retire functions synchronise the versioned editorial records with Phase 4 knowledge tables.
- Staff-only articles are not exposed through the public Phase 4 articles table.

## Not run / not verified

- No PostgreSQL server or connected Supabase project was used to execute migration 021. SQL was reviewed with structural/contract tests, not a live database parser/executor.
- Full Vite production build was not run: this overlay does not contain the full CALLORIA game repository and its root `index.html`, complete simulator source and all existing page inputs.
- No live Supabase Auth or Edge Function request was made.
- No live article/platform/service record was published or retired.
- No live staff briefing was published or acknowledged.
- No GitHub commit or Vercel deployment was performed.
- No physical device test was performed.

## Critical deployment prerequisites

- Phase 4 migration 005 must already exist because the publication RPC writes to `calloria_kb_articles`, `calloria_kb_platforms` and `calloria_kb_services`.
- The corrected Phase 20 migration 020 must have completed successfully before applying migration 021.
- Confirm migrations 001–019 are applied. Apply migration 021 once only.
- Supabase function Secrets must contain the existing `CALLORIA_ROUTING_ACCESS`, `CALLORIA_ALLOWED_ORIGINS`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values. No additional secret was introduced.
