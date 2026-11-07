# CALLORIA Phase 4 — RuffNeck Knowledge & Customer Care Foundation

This is an additive Supabase knowledge-base migration plus portable JSON source catalogues. It adds only `calloria_kb_*` tables. It does not alter existing CALLORIA tables, Prospector tables, auth triggers, existing RLS policies, or credentials.

## Contents
- `supabase/migrations/202611070005_calloria_knowledge_base.sql` — creates isolated platform, service, article and safety-rule tables; seeds current verified knowledge.
- `knowledge/platform-catalog.json` — six product/platform records and customer self-service flows.
- `knowledge/service-catalog.json` — fifteen RuffNeck service lines.
- `knowledge/advice-and-safety-library.json` — company/platform routing, complaints, wellbeing, relationships, habits, parenting, psychology, philosophy, career and crisis guidance.
- `knowledge/safety-rules.json` — operational guardrails.

## Apply
Use the Supabase SQL Editor for the existing project only after reviewing the migration. Run this migration once. It is designed to be repeatable for its own namespaced records. It does not require a new project. Do not rerun migrations 001–004.

## Important integration boundary
This package creates and seeds the knowledge data layer. It does **not** modify CALLORIA frontend, AI Edge Function, retrieval pipeline, agent desktop, telephony, or routing code because the current repository source was not available in this working package. The existing AI function must be updated separately to retrieve from these tables and cite/ground responses; merely creating tables does not make the live agent use them. No credentials or customer records are included.

## Customer-care design
Use the platform catalogue to route product support and self-service. Use service catalogue for service discovery and quote intake. Use advice articles for non-clinical general information. Crisis and safeguarding articles are escalation procedures, not chatbot-only responses. Verify variable commercial details live before quoting.

## Verification status
Static content and SQL structure prepared. Not executed against Supabase; not tested with live CALLORIA Edge Functions or browser.
