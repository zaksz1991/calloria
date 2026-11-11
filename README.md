# CALLORIA v5.3 — Service Reliability & Incident Control

An additive, browser-local service operations module for the CALLORIA Vite application. It provides an incident lifecycle, severity-based response clocks, customer/internal update records, follow-up ownership, planned maintenance and post-incident reviews.

## Files

Copy the four files in `public/` into the repository's existing `public/` directory:

- `service-reliability.html`
- `service-reliability.css`
- `service-reliability.js`
- `service-reliability-engine.js`

Do not replace the repository's Vite configuration or other application files. With CALLORIA's configured Vite `publicDir: 'public'`, the page is expected at `/service-reliability.html` after the copied files are included in a successful deployment.

## Included operations

- Incident registration against the six RuffNeck product/game services plus general customer service.
- Four configurable severity tiers with example acknowledgement and customer-update targets.
- Enforced lifecycle: Detected → Triaged → Investigating → Mitigating → Monitoring → Resolved → Closed.
- Assignment, severity-change rationale, response timeline and customer/internal update records.
- Follow-up tasks with named owner and due date.
- Resolution summary requirement and post-incident review gate before closure.
- Planned maintenance register with owner, start/end window and state changes.
- Read-only published notice display from Knowledge Operations v5.2.
- Explicit incident-to-Knowledge-Operations bridge that creates a **Draft** notice in the v5.2 local-storage record. The knowledge team must review and publish it separately.
- CSV incident register export and three synthetic scenario launchers.
- Responsive layout and local browser persistence.

## Data and integration boundaries

- Storage key: `calloria.service-reliability.v53`.
- Knowledge Operations key: `calloria.knowledge-operations.v52`.
- Cross-module storage access works only when both pages share the same browser profile and origin.
- The v5.2 bridge writes draft service notices only after an explicit user action. It does not auto-publish notices.
- The scenario launchers create synthetic records. They are not reports of live service faults.
- SLA clocks recalculate when the page renders or refreshes. There is no background scheduler, alert service or on-call paging.
- No live monitoring, telemetry, deployment automation, customer messaging, email, SMS, push notification, or telephony connection is implemented.
- Data remains in browser local storage. It is not shared across employees or devices and is not suitable for confidential incident evidence.
- Severity response targets are illustrative internal settings, not legal or contractual SLAs.

## Existing CALLORIA compatibility

The patch is deliberately additive. It does not change `main.js`, Vite configuration, authentication, Supabase, Groq, existing CRM pages, existing agent desks, GLB models or 3D scene files.

## Verification

See `VERIFICATION.md` for the focused tests and explicit unverified items.
