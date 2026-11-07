# CALLORIA Phase 5 — Live Knowledge Retrieval and Customer Care Workbench

Phase 5 turns the Phase 4 RuffNeck knowledge catalogue into a working, guest-first customer enquiry channel. It adds a dedicated `/customer-care.html` workbench, a browser client module, a server-side Supabase Edge Function, a database-backed rate limiter and Vite multi-page build configuration.

## What this implements

- One customer-care entry for RuffNeck Learn, RuffNeck Prospector, RuffNeck Connect, RuffNeck Social Hub, Kano Run / Kano Life and Kano Keke.
- Retrieval from the Phase 4 `calloria_kb_platforms`, `calloria_kb_services`, `calloria_kb_articles` and `calloria_kb_safety_rules` records.
- Customer enquiry classification into platform support, service enquiries, complaints, personal guidance and general customer care.
- Self-service instructions and grounded references to official RuffNeck platforms.
- Optional cross-sell recommendations only when a platform match is present and the enquiry is product/service related.
- Non-clinical guidance boundaries, crisis/safeguarding response and mandatory human handoff for critical cases.
- Guest access with no account required. Enquiries and answers are not written to CALLORIA's database or browser storage. Enquiry text is sent to Groq for inference. Groq states inference inputs and outputs are not retained by default, but may be temporarily retained for reliability or abuse monitoring for up to 30 days unless Zero Data Retention (ZDR) is enabled in Groq Data Controls. Review the provider policy and enable ZDR for the CALLORIA Groq organisation where available. The workbench tells customers this before they submit sensitive information.
- Browser-side and server-side redaction for credentials, Nigerian phone-number formats, long account/card numbers and email addresses.
- Atomic per-IP-fingerprint and per-guest rate limits. The database stores only HMAC hashes, request counts and short time buckets.
- Groq credentials and Supabase service-role access remain in Supabase Edge Function Secrets; they are not sent to the browser.

## Integration files

Copy these paths into the existing CALLORIA repository, preserving existing files unless a path below is explicitly named:

- `customer-care.html` → repository root.
- `index.html` → complete replacement based on the current inspected `main` version; adds Customer Care shortcuts to the game-launch screen and Operations Desk support card while preserving the existing simulator markup.
- `styles/customer-care.css` → `styles/customer-care.css`.
- `js/customer-care-engine.js` and `js/customer-care-workbench.js` → `js/`.
- `supabase/functions/calloria-customer-care/index.ts` → matching function folder.
- `supabase/migrations/202611070005_calloria_knowledge_base.sql` → `supabase/migrations/` (copied unchanged from Phase 4).
- `supabase/migrations/202611070006_calloria_kb_rate_limits.sql` → `supabase/migrations/`.
- `supabase/config.toml` → merge the three function settings into the existing Supabase config. Do not delete other project function settings.
- `vite.config.js` → repository root. This declares both the existing `index.html` and new `customer-care.html` as production build entries. The existing simulator `index.html` is not replaced.

The customer-care workbench is available directly at `/customer-care` because the existing Vercel configuration enables `cleanUrls`; `/customer-care.html` also works. The Customer Care link is visible from both the game-launch screen and the Operations Desk sidebar support card.

The existing `package.json` already includes `@supabase/supabase-js` and Vite; this phase does not require a new package dependency or change the existing version.

## Database migration order

Migrations 001–004 are already applied in the shared Supabase project and must not be rerun.

The Phase 4 knowledge migration 005 was generated but not previously confirmed as applied. Apply these two scripts once, in order:

1. `202611070005_calloria_knowledge_base.sql`
2. `202611070006_calloria_kb_rate_limits.sql`

The migration creates only `calloria_kb_rate_limits` and the `consume_calloria_kb_rate_limit` RPC, in addition to the Phase 4 `calloria_kb_*` tables. It does not modify Prospector tables, existing CALLORIA tables, authentication triggers or existing policies. The rate-limit function is executable only by `service_role`.

## Supabase Edge Function deployment

Deploy `calloria-customer-care` from `supabase/functions/calloria-customer-care/index.ts`.

Configure Edge Function Secrets in the existing Supabase project:

- `CALLORIA_CUSTOMER_CARE_GROQ_API_KEY` — CALLORIA Customer Care's dedicated Groq key. This unique name avoids changing the existing `GROQ_API_KEY` used by CALLORIA AI QA or another RuffNeck function. Do not reuse, rotate or replace another application's key.
- `CALLORIA_ALLOWED_ORIGINS` — exact comma-separated origins, including `https://calloria.vercel.app`. Add a local development origin only when needed.
- `CALLORIA_RATE_LIMIT_SALT` — recommended random secret used only to HMAC rate-limit fingerprints. When omitted, the function falls back to the Supabase service-role secret as its HMAC key.
- `CALLORIA_CUSTOMER_CARE_MODEL` — optional; defaults to `openai/gpt-oss-20b`. Allowed values are `openai/gpt-oss-20b` and `openai/gpt-oss-120b`.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The function requires the service key server-side to query published knowledge and call the private rate-limit RPC. Never place that key in Vercel or browser environment variables.

Set the new function's **Verify JWT** option to OFF because CALLORIA customer care is guest-first. This does not expose the Groq key. Exact-origin CORS, strict request limits, HMAC-based database rate limits and server-side validation remain active. The existing `calloria-ai-assist` Verify JWT setting remains ON; the telemetry function setting remains unchanged.

## Vercel environment

The page uses the existing public browser variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not add the Groq key, Supabase service-role key or rate-limit salt to Vercel. Rebuild and deploy the project after integrating the files. The new workbench is served at `/customer-care` (and the underlying `/customer-care.html` file); the existing game entry remains `/`.

## Operational boundaries

- The workbench can explain a self-service path but does not sign into a customer's account, alter account records, process money, issue refunds, send messages to external platforms or confirm real-time account status.
- Prices, availability, refunds, delivery commitments and changing feature details must be checked in the official platform or an authorised business system.
- Cross-selling is optional, limited to retrieved RuffNeck platform records and suppressed for complaints and personal-guidance enquiries.
- Life, relationship, parenting, psychology and wellbeing answers are general information, not diagnosis, treatment or psychotherapy.
- Critical self-harm, violence, abuse or immediate-danger disclosures receive a safety response and human handoff. Do not treat the chatbot as a crisis service.
- The current endpoint does not create CRM tickets or persist customer case notes. Those are a separate authenticated integration with consent, retention and tenant permissions.

## Verification

The accompanying `VERIFICATION.md` records exactly which checks ran. This package does not claim deployment to the user's GitHub, Supabase or Vercel projects.
