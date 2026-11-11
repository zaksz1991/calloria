# CALLORIA v5.4 — Customer 360 & Case Management

An additive customer-operations module for CALLORIA. It puts customer profiles, cross-channel case records, response commitments, interactions, ownership and service history into one standalone working view.

## Install

Copy the four files in this package's `public/` folder into the existing CALLORIA repository's `public/` folder. Preserve all existing files and the Vite configuration.

- `customer-journey.html`
- `customer-journey.css`
- `customer-journey.js`
- `customer-journey-engine.js`

CALLORIA's Vite setup uses `publicDir: 'public'`, so the expected route after those files are included in a successful deployment is:

`https://calloria.vercel.app/customer-journey.html`

This is an additive standalone page. It does not replace the existing `customer-360.html`, `case-desk.html`, `customer-care.html`, or agent workstation pages, and it is not inserted into the site's main navigation by this patch.

## Included capabilities

### Customer 360
- Searchable customer directory with synthetic demonstration profiles.
- New customer profile creation with duplicate checks on email and phone.
- Preferred channel, linked RuffNeck services, customer segment and separately recorded email, SMS and marketing permissions.
- Minimum-necessary internal customer notes.
- Consolidated customer timeline across cases, interactions, status changes and notes.

### Case management
- Cross-channel customer service cases for voice, email, live chat, social, SMS, in-app and internal transfer.
- Product/service, category, priority, team and named owner fields.
- Duplicate-open-case checks for matching customer, subject and category.
- Priority response targets: P1 four hours, P2 one day, P3 three days, P4 five days.
- Case lifecycle: New → Open → Pending Customer / Pending Internal → Resolved → Closed.
- SLA clock pauses while the case is Pending Customer. Internal waiting time continues to count.
- Resolution summary required before resolution; unresolved tasks block closure.
- Reopening a resolved case requires a reason and archives the previous resolution summary.
- Interaction records with channel, direction, author, visibility and summary.
- Owned follow-up tasks with due dates and completion control.
- Customer and internal interaction records are stored as records only; this module does not send messages externally.

### Connections to v5.2 and v5.3
- Read-only incident discovery from `calloria.service-reliability.v53`.
- Explicit creation of a customer-impact case linked to a selected open v5.3 incident. The case is a separate record; the v5.3 incident is not modified.
- Read-only search of published and unexpired knowledge articles from `calloria.knowledge-operations.v52`.
- Explicitly link a knowledge article reference into a case timeline. The article is not edited or published by this module.

### Reporting
- Current workload and SLA indicators.
- Product/service case breakdown.
- Recent operations activity.
- CSV case register export with formula-like field neutralisation.

## Storage and integration boundaries

- Customer/case storage key: `calloria.customer-journey.v54`.
- Incident source key: `calloria.service-reliability.v53` (read-only).
- Knowledge source key: `calloria.knowledge-operations.v52` (read-only).
- Cross-module reads require the relevant pages to have been used in the same browser profile and same origin.
- Customer/case records remain in browser local storage. They are not shared across employees or devices and may be removed when browser data is cleared.
- All starter customers and cases are synthetic. Email addresses use the reserved `.invalid` domain and phone numbers are dummy values.
- Do not enter real customer secrets, passwords, payment credentials, health information or other confidential records into this demonstration module.
- SLA targets are example calendar-time targets, not configured contractual or legal SLAs. They do not use business calendars or public holidays.
- No live telephony, email/SMS delivery, social platform APIs, external CRM, Supabase, HR, identity provider, background paging or multiplayer synchronization is implemented.

## Compatibility

The patch does not modify `main.js`, Vite configuration, authentication, Supabase, Groq, 3D/GLB assets, recruitment, OJT, or existing agent desks. No Groq key or existing integration is accessed.

See `CHANGELOG.md` and `VERIFICATION.md` for scope and checks.
