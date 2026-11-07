# CALLORIA Phase 8 — Omnichannel Agent Desk

**Build date:** 7 November 2026  
**Baseline:** Phase 7 integrated source overlay (Phases 4–7)  
**New staff page:** `/agent-desk`  
**New Edge Function:** `calloria-agent-desk`  
**New migration:** `202611070009_calloria_agent_desk.sql`

## What Phase 8 implements

A staff-only interaction workbench for RuffNeck Entertainment support and customer-care operations. It unifies operational work records across voice, email, live chat, social, WhatsApp, website, portal, game support and back-office channels.

- Department-scoped queue and work-item creation.
- Priority and internal response-target calculation (urgent 5 min, high 15 min, normal 60 min, low 4 hours). These are CALLORIA work-queue targets, not a promise of external service-level agreements.
- Atomic claim operation to prevent two agents claiming the same unassigned item.
- State machine for claimed, active, on hold, after-contact work, resolved and escalated interactions.
- Supervisor-visible escalation and reassignment through the shared queue.
- After-contact disposition and encrypted outcome summary.
- Encrypted interaction summaries and outcome notes using AES-256-GCM; ciphertext and IV are stored in the database.
- Version checks on state updates to reject stale concurrent changes.
- Compact activity timeline with no free-text event notes.
- Quick-reference panel populated from the imported Phase 7 RuffNeck catalogue snapshot, including all six products/platforms and games (bundled by Vite, not fetched from a public path).
- Optional Customer 360 CRM UUID and existing Case Desk reference links. These are references only; they do not fetch or modify CRM profiles or case records.
- Responsive desktop, tablet and phone layout.

## Important integration boundary

Phase 8 provides the staff work queue and handling-state engine. It does **not** connect a telephony carrier, SIP trunk, call recording system, WhatsApp Business API, Meta inbox, email provider, website chat provider or social-media API. The voice/hold/resume controls update CALLORIA's internal work state only. External conversations must be entered by an authorised agent or later ingested through separately authenticated provider adapters.

The work-item creation form manually logs an interaction. It must not be represented to staff as a live inbound call or automatically imported message. Future provider adapters should authenticate signed webhooks, deduplicate provider message IDs, verify customer consent, map provider identities through the Phase 7 verification workflow, and avoid storing credentials or unnecessary customer data.

The knowledge panel uses a static product catalogue snapshot. Product-specific self-service steps and general descriptions are available as quick reference, but current prices, enrolment status, feature entitlements, platform account status, game rewards, API availability and commercial terms must be verified with the relevant product owner/platform before being promised.

## Files to integrate

Use the complete Phase 7 overlay as the baseline. Add or merge the following:

| Package file | Repository destination | Action |
|---|---|---|
| `agent-desk.html` | `agent-desk.html` | Add |
| `js/agent-desk-engine.js` | same path | Add |
| `js/agent-desk-workbench.js` | same path | Add |
| `styles/agent-desk.css` | same path | Add |
| `assets/ruffneck-catalog.json` | `assets/ruffneck-catalog.json` | Keep the Phase 7 catalogue or compare/update it; do not overwrite a newer catalogue blindly |
| `vite.config.js` | `vite.config.js` | Merge the `agentDesk` input into the current config; do not discard newer entries/plugins |
| `supabase/functions/calloria-agent-desk/index.ts` | same path | Add and deploy |
| `supabase/functions/calloria-agent-desk/deno-globals.d.ts` | same path | Add for local static checking only |
| `supabase/migrations/202611070009_calloria_agent_desk.sql` | `supabase/migrations/` | Add and apply once |
| `supabase/config.toml` | `supabase/config.toml` | Merge only the new function entry |
| `tests/agent-desk-engine.test.mjs` | `tests/` | Add |

Do not replace `index.html`, `main.js`, `production-world.js`, `customer-care.html`, `case-desk.html`, `customer-360.html`, prior Phase 4–7 modules or project dependencies. The Agent Desk header links to those existing pages.

## Supabase installation

1. Confirm that migrations 005–008 are already applied as part of the preceding integrated phases.
2. Check migration history for `202611070009_calloria_agent_desk.sql`. Apply it once only if it is not already recorded as applied.
3. Deploy the `calloria-agent-desk` Edge Function.
4. Set its `verify_jwt` setting to **OFF**. The function verifies the signed-in staff token itself with `admin.auth.getUser(token)` and rejects every user absent from its separate server-side allowlist. Do not remove that check.
5. Configure the following under **Supabase → Edge Functions → Secrets**:

   - `CALLORIA_ALLOWED_ORIGINS`: exact comma-separated origins, including `https://calloria.vercel.app` and only the local origins actually used.
   - `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET`: new random high-entropy secret with at least 32 bytes. Keep it stable. Rotating it without decrypting/re-encrypting historical records will make stored summaries and wrap-up outcomes unreadable.
   - `CALLORIA_AGENT_WORKSPACE_ACCESS`: JSON mapping existing Supabase Auth staff UUIDs to `agent` or `supervisor` roles and permitted departments.

Example access map (replace UUIDs; do not copy placeholders):

```json
{
  "11111111-1111-4111-8111-111111111111": {
    "role": "supervisor",
    "departments": ["*"]
  },
  "22222222-2222-4222-8222-222222222222": {
    "role": "agent",
    "departments": ["RuffNeck Products and Platform Support"]
  },
  "33333333-3333-4333-8333-333333333333": {
    "role": "agent",
    "departments": ["Email and Written Support", "Social Media Support"]
  }
}
```

This permission map is separate from `CALLORIA_CASE_AGENT_ACCESS` and `CALLORIA_CRM_AGENT_ACCESS`. Access to case records or customer contact data does not automatically grant Agent Desk access. Give each employee the smallest department scope required for their role.

The function also uses Supabase's server-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service-role key, access map or encryption secret in Vercel browser environment variables, frontend files, GitHub or chat.

## Vercel/browser configuration

The page uses the existing public variables only:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

The Vite build must include `agent-desk.html` as a multi-page input. With the project's clean URL routing, this page is intended to be served at `/agent-desk`.

## Safeguards

- Interaction summaries and wrap-up notes are encrypted at rest in the Edge Function; no free-text event-note facility is provided.
- The form rejects common credential phrases, email addresses and phone-like strings. This is a safety filter, not a guarantee that every possible personal detail is detected. Agents must continue to minimise the data they enter.
- Do not store passwords, OTPs, PINs, payment-card details, API keys, full identity-document numbers or sensitive personal-guidance narratives.
- Personal-development and wellbeing conversations must be handled with the Phase 4–5 safeguarding boundaries. The Agent Desk is not a clinical record or a substitute for qualified care.
- The activity timeline records workflow events only; it does not record call audio or transcribe customer speech.
- RLS is enabled and direct browser grants are revoked on both new tables. All data access goes through the staff-authenticated Edge Function.
- Claiming is atomic. Status transitions use optimistic version checks to prevent silent overwrites.

## Verification and limitations

See `VERIFICATION.md`. The source package is not a GitHub commit or a live deployment. Full project build, existing repository tests, Supabase migration execution, provider integrations and live device rendering have not been performed in this workspace.
