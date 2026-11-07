# CALLORIA Phase 9 verification report

Date: 7 November 2026

## Checks performed

- `node --check js/agent-desk-workbench.js`: PASS (the reported apostrophe parse error is corrected).
- `node --check js/wfm-engine.js`: PASS.
- `node --check js/wfm-workbench.js`: PASS.
- `node --check vite.config.js`: PASS.
- `node --test tests/wfm-engine.test.mjs`: 11 passed, 0 failed.
- `npx tsc --noEmit -p tsconfig.edge.json`: PASS using the included local Deno/Supabase ambient declarations. This is static TypeScript checking, not a live Edge Function deployment test.
- `workforce.html` parser check: PASS; 41 unique IDs and all 41 directly referenced `#id` selectors are present.
- SQL static inspection: PASS; new `calloria_wfm_*` namespace only, RLS enabled on all seven tables, browser grants revoked, service-role grants scoped to the new tables, and no destructive statements against existing objects.
- Supabase configuration check: existing AI Assist and game telemetry settings are retained; existing Phase 5–8 function settings are included; Workforce function is added with handler-side JWT validation.
- ZIP integrity: verified after packaging (archive test passes).

## Not performed

- Full `npm test` across the complete GitHub repository.
- Full Vite production build against the complete CALLORIA working tree and installed dependencies.
- Execution of migration 010 against the shared Supabase project.
- Live deployment or authentication/database requests against `calloria-workforce`.
- Real supervisor/agent account test using the user's actual Supabase Auth UUIDs.
- Browser-based desktop/Android QA or Vercel deployment.
- Live telephony integration, agent device monitoring, payroll, leave-management or automatic notifications.

## Scope

Phase 9 introduces a separate server-backed staff workforce page and the new `calloria_wfm_*` database namespace. It does not modify existing Prospector tables, the shared authentication profile trigger, prior CALLORIA customer-care/CRM/case tables or the original simulation's `workforce-engine.js` / `shift-engine.js` files.
