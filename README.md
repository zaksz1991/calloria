# CALLORIA Phase 20 — Operations Intelligence Command Centre

Phase 20 adds a restricted, aggregate-only command centre to the Phase 19-integrated CALLORIA project.

## What it provides

- Supervisor / people-admin department aggregate view; agent accounts receive a personal-only view.
- Seven, 30 and 90 day reporting windows.
- Work items received, resolved, active backlog, overdue workload, resolution SLA and average resolution time.
- Current queue risks: aged urgent/high-priority work, overdue work, hold and after-contact work.
- Work item volume by channel and department, plus daily received / resolved trend.
- Workforce snapshot from published shifts and current attendance activities.
- Aggregate QA reviews, QA pass rate, critical quality failures, reviewed scorecards and open coaching plans.
- Provider message outcomes for WhatsApp, email, Meta social and SMS, using the status values available in each channel schema.
- Telephone call totals, disposition counts and average recorded connected duration.
- Refresh on demand and every 60 seconds while the tab is visible.

The dashboard query intentionally does not select or return customer names, contact details, message bodies, encrypted payloads, case narratives, webhook payloads, authentication tokens or raw customer identifiers. It reports work-item volumes, not unique human customers. It does not claim that a sent email was delivered: the current email message schema only records sent / failed / unknown.

## Integration baseline

This is an incremental overlay on the Phase 19-integrated CALLORIA repository. It is not a complete replacement project. Preserve the original CALLORIA game, root `index.html`, `js/main.js`, world files, assets, all earlier migrations and provider configuration. Merge this overlay's new files and integration edits into the current Phase 19-integrated repository.

New files:

- `operations-intelligence.html`
- `styles/operations-intelligence.css`
- `js/operations-intelligence-engine.js`
- `js/operations-intelligence-workbench.js`
- `supabase/functions/calloria-operations-intelligence/`
- `supabase/migrations/202611080020_calloria_operations_intelligence.sql`

Updated integration files:

- `vite.config.js` adds the dashboard as a multi-page Vite input.
- `supabase/config.toml` adds the function setting with `verify_jwt = false`; the handler validates the Supabase user JWT itself.
- `package.json` adds syntax checks for the two new browser modules and retains existing scripts/dependencies.
- Existing Agent Desk and provider inbox navigation gains a Command Centre link.

## Installation

1. Merge the Phase 20 overlay into the Phase 19-integrated repository. Do not replace the whole repo with this archive. Preserve all unlisted files.
2. Confirm CALLORIA migrations 001–019 are already applied. Apply only `202611080020_calloria_operations_intelligence.sql` once.
3. Deploy the new Edge Function folder `calloria-operations-intelligence`.
4. Add the function configuration from this package to the existing `supabase/config.toml` if deploying with Supabase CLI. Preserve all existing function settings.
5. No new Supabase secret is required. The function reuses the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CALLORIA_ALLOWED_ORIGINS` and `CALLORIA_ROUTING_ACCESS` Edge Function secrets. Do not rotate, overwrite or repurpose any existing credential.
6. Run the full repository's production build after merging, then deploy through the existing Vercel workflow.

Do not rerun migrations 001–019. Migration 020 adds query-supporting indexes and one service-role-only aggregate function. It does not alter Prospector tables, shared profiles, auth triggers, staff records, existing customer records or provider channel tables.

## Access model

- `agent`: personal view only. The server derives the staff ID from the validated Supabase session. Client-supplied staff IDs are ignored. An agent cannot request department aggregates or another staff member's data.
- `supervisor`: aggregate metrics for the departments in that user's `CALLORIA_ROUTING_ACCESS` grant.
- `people_admin`: aggregate-only workforce / service totals across the granted department scope. The response does not contain employee names, IDs or individual records.

The Edge Function validates the JWT using `auth.getUser()` and checks the existing access map. The SQL function is `SECURITY DEFINER`, but execute permission is revoked from `public`, `anon` and `authenticated`, and granted only to `service_role`. It returns aggregate JSON only and has no parameters for customer content or arbitrary query fragments.

## Metric definitions and limits

- **Contacts received:** Agent Desk work items created during the selected period. This is not a count of unique customers or all provider webhook events.
- **Resolved:** work items whose `resolved_at` timestamp falls inside the selected period.
- **Active backlog:** current work items in pending, claimed, active, on-hold, after-contact-work or escalated states.
- **Overdue:** active work items whose `due_at` is earlier than the database current time.
- **Resolution SLA:** resolved work items with a due timestamp that resolved at or before `due_at`, divided by all resolved work items with a due timestamp. Items without a due time are excluded from the denominator.
- **Average resolution:** mean elapsed time from work-item creation to resolution among valid resolved records in the period.
- **Staffing coverage:** currently published shifts with a live attendance record and no clock-out, grouped by the recorded activity. It is not physical presence or carrier availability verification.
- **QA:** only recorded QA reviews; missing reviews are not assumed to be passes. Critical failures are reported separately.
- **Provider outcomes:** only the status semantics available in each provider table are used. For email and social, `delivered` is returned as null (shown as a dash) because the Phase 15 / 17 schemas do not store a separate delivered state. Provider counts are outbound messages, not recipients or customers.
- **Voice:** counts and durations are read from CALLORIA's voice call records. Recordings remain off; no recording / transcription data is accessed.
- **Time zone:** database timestamps are generated in UTC. The browser formats the generated timestamp in the local display timezone. Daily groupings use the database session date (normally UTC).

The dashboard is an operations aid. It does not replace finance reconciliation, regulatory reporting, HR decisions, QA calibration or source-system audits. A zero or null is not proof of no activity if a channel was not fully deployed or migrated.

## Verification

The package tests pure formatting and snapshot-normalisation logic, checks browser module syntax, checks the Edge Function TypeScript sources, validates the SQL / page / config structure, and checks ZIP integrity. It does not execute migration 020 against the shared Supabase project, exercise real Supabase Auth, run a full Vite build (the overlay does not contain the entire game repository), query production records, or deploy to GitHub / Vercel.
