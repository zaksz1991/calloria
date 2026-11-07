# CALLORIA Phase 11 — RuffNeck Sales & Ethical Cross-Sell Desk

**New staff page:** `/sales-desk.html`  
**New Edge Function:** `calloria-sales-desk`  
**New database migration:** `202611070012_calloria_sales_enablement.sql`

Phase 11 gives CALLORIA staff a structured way to understand a customer's actual need, identify a relevant RuffNeck product or service, record which options were presented, capture the customer's decision and schedule a consent-verified follow-up task.

This is a staff sales-enablement workspace. It is not an online checkout, payment system, live campaign sender or revenue ledger.

## RuffNeck portfolio coverage

The desk uses the existing Phase 8 `assets/ruffneck-catalog.json` catalogue and covers:

1. **RuffNeck Learn** — AI and digital skills, structured learning and professional development enquiries.
2. **RuffNeck Prospector** — prospecting, lead workflow and business-growth needs.
3. **RuffNeck Connect** — community participation, collaboration and networking.
4. **RuffNeck Social Hub** — social-media operations, brand and content workflows.
5. **Kano Run / Kano Life** — Kano-themed driving and life-simulation entertainment.
6. **Kano Keke** — Kano keke-driving and life-simulation entertainment.

The six product pages show the catalogue's high-level service descriptions and sales boundaries. The agent must verify current feature availability, account status, pricing, discounts, service levels, supported channels and commercial terms on the destination platform or with the product owner before promising them. No price or feature claim is fabricated in this workspace.

The catalogue's related service lines include digital-skills training, business-prospecting support, community and collaboration, social-media operations, customer-care consultation and game entertainment. If no product matches the need, the UI explicitly tells the agent not to force a sale.

## What it does

- Staff-only login using existing Supabase Auth accounts and a separate Sales Desk permission map.
- Department-scoped opportunity creation and pipeline visibility.
- Customer need categories covering learning, business growth, community collaboration, social-media operations, games, career development, customer-care consultation, technical support, product access and cross-platform needs.
- Optional Customer 360 record linking. The UI accepts only the CRM UUID, not customer email or phone details.
- Server-side encrypted opportunity summaries. Common phone, email, credential and long financial-number patterns are redacted before encryption.
- Deterministic need-to-product matching from the existing RuffNeck portfolio catalogue; a maximum of three options can be presented per action.
- Customer response tracking: presented, interested or declined, with a dedicated response audit event and guarded single-response update.
- Pipeline states: new, discovery, recommended, customer interested, referred to platform, follow-up due and closed/no interest.
- A customer referral hand-off to the owning platform. A referral does not claim that an account was created, a payment occurred or a sale was completed.
- Follow-up task creation linked to the Customer 360 record and the specific granted consent record.
- Minimal event history without customer contact details or personal narratives.

## Ethical cross-selling controls

### Customer-requested recommendation

The opportunity source must be recorded as `customer_requested` before a customer-requested product recommendation can be presented. This is a staff-recorded statement that the customer explicitly asked for product information; it is not inferred from an ordinary support enquiry.

### Proactive cross-sell

Proactive recommendations require all of the following:

- A linked Customer 360 record.
- The latest `marketing` consent entry for that customer must be `granted`.
- The consent is checked on the server at the time the recommendation is presented.

A missing, revoked or `not_granted` marketing consent blocks proactive cross-selling. Service-contact consent is not treated as marketing consent.

### Follow-up

A follow-up is only a staff task; this function does not send email, WhatsApp, SMS, social messages or telephone calls. Scheduling requires a linked Customer 360 record and the latest granted consent for the exact purpose selected:

- `service_contact` for a customer-requested service follow-up.
- `marketing` for promotional or marketing contact.

A service-contact consent does not authorise marketing. A marketing consent does not authorise an unrelated service disclosure. Follow-up tasks are limited to the next 90 days. Removing a Customer 360 record or its consent cascades deletion of linked follow-up tasks; the opportunity is retained with its CRM link set to null.

## Commercial and data boundaries

- No prices, quotation totals, discounts, subscriptions, plan entitlements or sales targets are invented.
- No card or bank transaction is initiated or accepted.
- No customer is automatically enrolled in a marketing list.
- No outbound communication is sent. Staff must use an approved platform or communication provider outside this package after checking consent and policy.
- The workflow has no `won` or `converted` stage. A recommendation or platform referral is not proof of purchase. Transaction confirmation belongs to the owning platform.
- Customer summaries are encrypted with AES-GCM server-side. Do not add passwords, PINs, OTPs, payment information or sensitive personal/therapeutic narratives.
- Personal-development and wellbeing enquiries remain in their appropriate customer-care/safeguarding paths. This sales module does not score, package or monetise a person's distress.

## Integration baseline

Use the Phase 10-integrated CALLORIA repository as the baseline. This ZIP is an incremental overlay, not a replacement for the full game repository.

### Add these files

| Package file | Repository destination | Action |
|---|---|---|
| `sales-desk.html` | `sales-desk.html` | Add |
| `js/sales-desk-engine.js` | same path | Add |
| `js/sales-desk-workbench.js` | same path | Add |
| `styles/sales-desk.css` | same path | Add |
| `supabase/functions/calloria-sales-desk/index.ts` | same path | Add and deploy |
| `supabase/functions/calloria-sales-desk/deno-globals.d.ts` | same path | Add for local static type-checking |
| `supabase/migrations/202611070012_calloria_sales_enablement.sql` | `supabase/migrations/` | Add and apply once |
| `tests/sales-desk-engine.test.mjs` | `tests/` | Add |
| `tests/sales-desk-contract.test.mjs` | `tests/` | Add |

### Replace with the included merged files

- `agent-desk.html` — same Phase 10 Agent Desk page, with a Sales Desk navigation link.
- `vite.config.js` — retains the existing seven page inputs and adds `sales-desk.html`.
- `package.json` — retains the Phase 10 dependencies and scripts and adds syntax checks for the Sales Desk modules.
- `supabase/config.toml` — preserves all Phase 10 function entries and adds `calloria-sales-desk` with handler-side JWT validation.
- `tsconfig.edge.json` — preserves the prior Agent Desk, Workforce and Performance function check paths and adds Sales Desk.

The package includes `assets/ruffneck-catalog.reference.json` only as a reference snapshot for the tests and review. The runtime imports the existing `assets/ruffneck-catalog.json` from Phase 8. **Do not overwrite that current repository catalogue with the reference snapshot.**

Do not replace `index.html`, `main.js`, `game.js`, `renderer3d.js`, `production-world.js`, existing career/shift/voice/multichannel engines, customer-care, case-desk, Customer 360, Workforce or Performance modules with unrelated older copies. Preserve later repository changes.

## Supabase installation

1. Confirm migrations `001`–`011` are already applied. Review Supabase migration history first; do not rerun any earlier migration.
2. Confirm migration `202611070008_calloria_customer_360.sql` is present because migration 012 adds foreign keys to Customer 360 contacts and consent records.
3. Apply `202611070012_calloria_sales_enablement.sql` exactly once.
4. Deploy the `calloria-sales-desk` Edge Function.
5. Set `verify_jwt = false` for this function in the supplied `supabase/config.toml`. The function independently validates the bearer token through `admin.auth.getUser(token)` and then checks the Sales Desk access allowlist. Do not remove the handler-side checks.
6. In **Supabase → Edge Functions → Secrets**, add:
   - `CALLORIA_ALLOWED_ORIGINS` — comma-separated exact origins, including `https://calloria.vercel.app` and only the local development origins actually used.
   - `CALLORIA_SALES_DESK_ACCESS` — JSON map from existing employee Supabase Auth UUIDs to an approved role and explicit department scope.
   - `CALLORIA_SALES_DESK_ENCRYPTION_SECRET` — a new, independent secret with at least 32 characters. Keep it private and do not reuse the Groq key, Customer 360 encryption secret or any Prospector secret.

Example permission-map structure only; replace every placeholder UUID with the corresponding existing employee Auth UUID and keep each scope limited to the departments actually assigned:

```json
{
  "<existing-sales-adviser-auth-uuid>": {
    "role": "sales_advisor",
    "departments": ["Sales and Service Enquiries", "RuffNeck Products and Platform Support"]
  },
  "<existing-sales-supervisor-auth-uuid>": {
    "role": "sales_supervisor",
    "departments": ["Sales and Service Enquiries", "RuffNeck Products and Platform Support"]
  },
  "<existing-people-admin-auth-uuid>": {
    "role": "people_admin",
    "departments": ["*"]
  }
}
```

Supported roles: `agent`, `sales_advisor`, `supervisor`, `sales_supervisor`, `people_admin`. Frontline `agent` and `sales_advisor` entries require explicit department scopes and can view their own opportunities. Supervisors can view opportunities in their assigned departments. `people_admin` requires wildcard scope. Access to Sales Desk is separate from Customer 360, Agent Desk, Workforce and Performance permissions; add only the employees who need it.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function. Do not copy the service-role key, encryption secret or access map into Vercel browser environment variables, repository files or chat. The existing Groq key and all Prospector-specific credentials remain untouched.

## Verification

See `VERIFICATION.md`. The focused unit and contract tests, JS syntax checks and Edge Function TypeScript static check are included. The complete repository Vite build, live Supabase migration, actual staff authentication and deployed browser workflow require the Phase 10-integrated repository and Supabase project; they were not run in this isolated overlay workspace.
