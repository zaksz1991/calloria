# CALLORIA Phase 21 — Knowledge Operations & Product Governance

Phase 21 adds a staff-only editorial control centre for maintaining the knowledge CALLORIA uses to explain RuffNeck products, services, platform self-service and customer-care guidance. It is an incremental overlay on the **corrected Phase 20 package**. It is not a complete replacement for the CALLORIA repository.

## What it adds

- A staff Knowledge Operations page at `/knowledge-operations.html`.
- Versioned authoring for three record types: knowledge articles, RuffNeck platform catalogue entries and RuffNeck service catalogue entries.
- Draft, submit-for-review, independent approval, publish and retire workflow.
- Source URL and last-verified date for factual governance.
- A 180-day source-freshness gate for platform and service records, and for psychology, wellbeing, parenting, safeguarding, security, health, legal, financial, product knowledge, platform support, service enquiries, complaint recovery, pricing and plans categories.
- Atomic database publication: the versioned editorial record and the customer-facing Phase 4 knowledge record are synchronised in one PostgreSQL transaction.
- Staff notices for product updates, service changes, policy updates, security notices, known issues and training notices.
- Department-targeted briefing notices with start/end times and optional staff acknowledgement.
- Navigation from Agent Desk, Command Centre and provider inbox workspaces.

## How publication works

The existing Phase 4 `calloria_kb_platforms`, `calloria_kb_services` and `calloria_kb_articles` tables remain the retrieval surface consumed by the guest-first Customer Care Edge Function. Phase 21 introduces the separate `calloria_km_*` editorial workflow. Content does not become customer-visible merely because a draft is saved or submitted.

1. An agent can read published knowledge only.
2. A supervisor or people administrator can create and maintain drafts.
3. The author submits a draft for review.
4. A different `people_admin` account must approve it. Authors cannot approve their own submissions.
5. A people administrator publishes an approved version. Publication atomically synchronises article, platform or service fields into the corresponding Phase 4 `calloria_kb_*` table.
6. Retirement atomically disables or retires the public retrieval record. Historical versions and review events remain in the `calloria_km_*` tables.

A newly published revision replaces the existing public catalogue/article record only when its independent approval is completed. An existing live version remains available while a new version is only a draft or awaits review.

### Audience protection

Phase 4's public article-read policy is status-based. For that reason, Phase 21 has a database-level guard: an article marked `staff` is never published into the public `calloria_kb_articles` table; if a same-slug public record exists, it is retired there. `customer` and `both` articles may be published into customer retrieval. Staff-only content remains available only through the authenticated staff Knowledge Operations API.

## Staff notice and briefing support

Notices can be associated with one or more of the six products and targeted to approved CALLORIA departments. Supervisors' blank department targets default to their own permitted department scope; they cannot silently publish an organisation-wide notice. Only a different people administrator can publish a supervisor's briefing draft. Staff can acknowledge active acknowledgement-required notices.

This is a notice and acknowledgement facility that supports the established 7:30 AM and 2:00 PM briefing routine. It does **not** automatically schedule a meeting, push an external notification, or alter the existing Workforce briefing scheduler.

Do not put customer names, email addresses, phone numbers, account numbers, passwords, OTPs, tokens or private case narratives in shared knowledge records or staff notices.

## Integration baseline

The archive carries forward the Phase 20 fixed overlay, including the repaired daily-trend SQL migration. It preserves the earlier provider inbox pages, Agent Desk workbench, Operations Intelligence page, Vite multi-page configuration and Supabase function configuration included in that Phase 20 package.

New Phase 21 files:

- `knowledge-operations.html`
- `styles/knowledge-operations.css`
- `js/knowledge-operations-engine.js`
- `js/knowledge-operations-workbench.js`
- `supabase/functions/calloria-knowledge-operations/`
- `supabase/migrations/202611080021_calloria_knowledge_operations.sql`
- `tests/knowledge-operations-*.test.mjs`
- `knowledge/` — reference copies of the Phase 4 seed catalogue and guidance JSON files

Updated integration files:

- `vite.config.js` adds the new page to the multi-page build.
- `package.json` adds syntax checks for the two new browser modules.
- `tsconfig.edge.json` includes the new Edge Function in the existing edge-function static check.
- `supabase/config.toml` adds `calloria-knowledge-operations` with `verify_jwt = false`; the function validates the signed-in staff session itself.
- Existing staff navigation links include Knowledge Operations.

## Installation

1. Start from the Phase 20-integrated CALLORIA repository and merge the Phase 21 archive. Do not replace the whole repository with this overlay. Preserve the main game, root `index.html`, `js/main.js`, world source, assets and any unlisted files.
2. Confirm migrations 001–019 are applied. Confirm the **corrected** Phase 20 migration `202611080020_calloria_operations_intelligence.sql` has completed successfully. Do not rerun it if it has already succeeded.
3. Confirm Phase 4 knowledge migration 005 is present: the existing tables `calloria_kb_platforms`, `calloria_kb_services`, `calloria_kb_articles` and `calloria_kb_safety_rules` must exist. Migration 021 depends on those tables for atomic publication.
4. Apply only `202611080021_calloria_knowledge_operations.sql` once.
5. Deploy the new Edge Function folder `calloria-knowledge-operations`.
6. Merge the new function entry into the existing `supabase/config.toml`; preserve all prior function entries and settings.
7. The function reuses the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CALLORIA_ALLOWED_ORIGINS` and `CALLORIA_ROUTING_ACCESS` Supabase Edge Function Secrets. No new private secret is required. Do not add the service-role key or access map to Vercel.
8. Keep the existing public browser variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. Run the full repository build after merging, then deploy through the existing Vercel workflow.

Do not rerun migrations 001–020. If migration 020 has not succeeded, use the separate Phase 20 SQL repair already provided and verify it before applying 021. If the Phase 4 `calloria_kb_*` tables are absent, stop and reconcile the existing migration history rather than attempting to run earlier CALLORIA or Prospector migrations against the shared database.

## Access map

The Edge Function validates the user's Supabase Auth token with `auth.getUser()` and then resolves the exact user ID in `CALLORIA_ROUTING_ACCESS`:

- `agent`: can view published records and acknowledge active notices; cannot draft, review or publish.
- `supervisor`: can author drafts and submit them for review; can see published content and their own draft briefings. Department targets default to the supervisor's own grant.
- `people_admin`: can see the editorial queue, review other people's submissions, publish approved records, retire published records and publish notices. The existing access-map format requires `people_admin` to have `departments: ["*"]`.

The code enforces two-person approval at the application API and again inside the database publication function. Only the service-role Edge Function can execute the publication and retirement RPCs. Browser roles have no direct table grants or RLS policies on the new editorial tables.

## Knowledge-source policy

- Platform and service catalogue entries require an HTTPS source and a verification date within the previous 180 days before publication.
- Articles in psychology, wellbeing, parenting, safeguarding, security, health, legal, financial, product knowledge, platform support, service enquiry, complaint recovery, pricing and plans categories require the same source freshness.
- Other general articles can be published without an external source, but must include a change summary and independent review.
- Do not claim current prices, quotas, plan entitlements, delivery dates, refunds, live account state or third-party integrations unless the source is authoritative and current. Where values change frequently, direct the customer to the owning live platform instead of hard-coding the value.
- Personal guidance remains general and non-clinical. Do not publish diagnoses, treatment plans or advice that substitutes for qualified professional care or emergency services.

## Database isolation

Migration 021 creates only `calloria_km_*` tables, indexes, a timestamp trigger and two service-role-only database functions. All new tables have RLS enabled and direct privileges revoked from `anon` and `authenticated`. The only writes to the existing Phase 4 KB occur inside the two security-definer publication/retirement functions, which are executable only by `service_role` and use fixed table names and validated record types.

No Prospector table, shared profile, organisation table, authentication trigger, previous provider table or previous CALLORIA migration is altered by migration 021.

## Verification and limits

See `VERIFICATION.md` for exact local checks. The package's included baseline and Phase 21 Node test suite was run. New JavaScript syntax, TypeScript edge configuration, HTML IDs and page wiring were checked. The complete Vite production build, execution of migration 021 against Supabase, live Auth tests, live knowledge publication and Vercel deployment were not performed. This is a source integration package, not a live database change or GitHub commit.
