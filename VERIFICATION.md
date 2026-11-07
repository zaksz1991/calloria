# CALLORIA Phase 10 verification report

Date: 7 November 2026

## Checks run in the Phase 10 integration workspace

- `node --check js/performance-engine.js`: PASS.
- `node --check js/performance-workbench.js`: PASS.
- `node --check js/agent-desk-workbench.js`: PASS (the earlier reported apostrophe parse error remains corrected in the included file).
- `node --check vite.config.js`: PASS.
- `tsc --noEmit -p tsconfig.edge.json`: PASS using the included Deno/Supabase ambient declarations.
- `node --test tests/*.test.mjs`: **15 passed, 0 failed**.
- HTML ID uniqueness and JavaScript selector references: PASS.
- Performance page script/style entry points: PASS.
- Workforce and Agent Desk navigation links: PASS.
- Vite multi-page entry list includes the Performance page and all Phase 9 pages: PASS (static configuration inspection).
- Supabase function configuration preserves Phase 9 entries and adds Performance with handler-verified JWTs: PASS (static configuration inspection).
- SQL namespace/RLS scan: PASS; all new tables are in `calloria_perf_*`, browser grants are revoked, and the migration contains no destructive statements against existing objects.
- Exam policy static checks: one attempt per target role per calendar year, no more than three attempts in the first three-year window, and no retake after a pass.
- ZIP integrity: PASS after packaging.

## Not performed

- Full `npm run build` against the complete Phase 9-integrated CALLORIA repository. The Phase 10 workspace is an overlay and does not contain the root game/application source tree.
- Full existing application test suite from the user's current GitHub working tree.
- Execution of migration 011 against the shared Supabase project.
- Live deployment of `calloria-performance` or testing with actual Supabase staff accounts.
- End-to-end browser interaction test, physical Android QA or Vercel deployment.
- Live telephony/CRM/CSAT/email/social/WhatsApp metrics ingestion.

## Scope and data protection

The new migration creates only `calloria_perf_*` objects. It does not alter existing Prospector tables, shared auth triggers, Phase 1–9 CALLORIA tables, or the original simulation's game/career/workforce engines. Direct browser table grants are revoked; requests are brokered through the authenticated Edge Function.
