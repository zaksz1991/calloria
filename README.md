# CALLORIA Phase 14 — WhatsApp Business Cloud Integration

## Scope

Phase 14 adds the first provider-connected external messaging channel to CALLORIA: the official Meta WhatsApp Business Platform Cloud API. It is an incremental overlay on the Phase 13-integrated CALLORIA repository, not a full repository replacement.

The staff page is `/whatsapp-inbox.html`.

### Included

- Meta webhook verification handshake using `CALLORIA_META_WEBHOOK_VERIFY_TOKEN`.
- HMAC-SHA256 validation of the raw webhook body using `CALLORIA_META_APP_SECRET` before JSON parsing.
- Strict matching to the configured Meta `phone_number_id`, preventing events from another number on the same Meta app from entering this inbox.
- Encrypted WhatsApp contact, profile-name and message storage (AES-256-GCM/HKDF); keyed HMAC contact lookup; masked phone numbers in the browser.
- Inbound message and delivery-status handling with provider-message idempotency.
- Automatic Contact Routing creation/attachment using the existing Phase 12 `calloria_route_create_request` flow and existing Agent Desk encrypted-summary key.
- Staff authentication through Supabase Auth plus the existing `CALLORIA_ROUTING_ACCESS` permission map. A staff grant must explicitly include the `whatsapp` channel, an allowed department, appropriate skills/languages and a compatible Agent Desk grant.
- Assigned Agent Desk work item required before a normal agent can open/reply. Supervisors are restricted to their configured department scopes.
- Outbound human text replies through Meta Cloud API, with a 24-hour service-window check, customer opt-out check, per-staff send limit and conservative handling of ambiguous provider timeouts.
- `STOP` / `UNSUBSCRIBE` / equivalent instructions block further sends and clear recorded marketing and service-follow-up consent. `START` reopens service replies only; it does not reinstate marketing or follow-up consent.
- Marketing and service-follow-up consent recorded separately, with staff identity, evidence type and a non-sensitive reference to the actual evidence.
- An explicit retention purge function: conversations and encrypted messages become eligible after 180 days without activity when no active routed work remains; webhook idempotency records are eligible after 30 days.

### Deliberate limitations

- This phase supports Meta WhatsApp Business Cloud API only. It is not WhatsApp Web automation and does not scrape or control a personal WhatsApp account.
- Only free-form text replies are implemented. They are blocked once the 24-hour customer-service window expires. Approved template creation/approval/sending is not included.
- Proactive marketing, outbound campaigns and cross-sell broadcasts are not implemented. Consent fields are records only; they are not an outbound marketing trigger.
- Inbound image, audio, video, document, sticker, location and other non-text events are recorded as a typed placeholder. Media is not downloaded or displayed in this phase.
- No telephone carrier/PSTN, email provider, social-network inbox or live-chat provider is connected by this phase.
- Language and intent classification are lightweight heuristics, not AI translation or a definitive assessment. Agents must confirm the routing details with the customer.
- The send result is marked `unknown` rather than automatically retried when a network timeout or incomplete provider response makes delivery ambiguous. Check the Meta conversation before manually retrying.
- The `calloria_wa_purge_expired()` SQL function is included but is not scheduled automatically. Configure a trusted Supabase Cron invocation before treating retention as automated.

## Integration baseline and files

Base this overlay on the Phase 13-integrated project. Preserve existing game files, the existing launch experience, all prior phases and local modifications.

New files:

- `whatsapp-inbox.html`
- `js/whatsapp-engine.js`
- `js/whatsapp-inbox-workbench.js`
- `styles/whatsapp-inbox.css`
- `supabase/functions/calloria-whatsapp/index.ts`
- `supabase/functions/calloria-whatsapp/whatsapp-engine.ts`
- `supabase/functions/calloria-whatsapp/deno-globals.d.ts`
- `supabase/migrations/202611070014_calloria_whatsapp_channel.sql`
- `tests/whatsapp-engine.test.mjs`
- `tests/whatsapp-contract.test.mjs`

Complete replacement/merge files included:

- `agent-desk.html` — adds the WhatsApp Inbox navigation link and clarifies which channels are provider-connected.
- `vite.config.js` — preserves the Phase 13 multi-page inputs and adds `whatsapp-inbox.html`.
- `package.json` — preserves the Phase 13 scripts and adds checks for the Phase 14 browser modules.
- `supabase/config.toml` — preserves prior function settings and sets `calloria-whatsapp` to `verify_jwt = false`; Meta does not send a Supabase JWT to its webhook, so the function verifies Meta's signature itself and independently verifies Supabase Auth for staff actions.
- `tsconfig.edge.json` — adds the Phase 14 Edge Function to static checking.

The Edge Function includes its own local helper file so the function can be deployed as a self-contained function folder. The browser module is kept separately for Vite.

## Installation sequence

1. Confirm that the Phase 13-integrated repository contains the earlier CALLORIA pages, Phase 12 Contact Routing objects and Edge Function, Phase 8 Agent Desk, Phase 9 Workforce, and their configured secrets.
2. Merge the included `vite.config.js`, `package.json`, `supabase/config.toml`, and `tsconfig.edge.json` with any project-specific changes. Do not replace other repository files wholesale.
3. Add the new HTML, browser modules, stylesheet, tests and `supabase/functions/calloria-whatsapp/` folder.
4. Check Supabase migration history. Confirm `202611070013_calloria_contact_routing.sql` is already applied. Apply `202611070014_calloria_whatsapp_channel.sql` exactly once.
5. Deploy the complete `calloria-whatsapp` Edge Function folder, including both `index.ts` and `whatsapp-engine.ts`.
6. Configure the Supabase Edge Function secrets listed below. Do not put private Meta or encryption secrets in Vercel.
7. In the Meta Developer app, add/configure the WhatsApp product and subscribe the app's webhook to the `messages` field. Use the callback URL below and enter the exact same verification-token secret. Confirm the webhook's `phone_number_id` matches the server secret.
8. Confirm that the Meta app/business has an approved WhatsApp Business sender number and an access token with the permissions required by the Cloud API. Complete Meta's business verification or number onboarding requirements as applicable to the account.
9. Add `whatsapp` to the channel list for only those staff UUIDs authorised to handle WhatsApp in the existing `CALLORIA_ROUTING_ACCESS` map. Ensure their department, language and skill scopes match the published Workforce shifts and Phase 12 routing rules. Do not use broad wildcard grants for ordinary agents.
10. Deploy the Vercel multi-page app after the migration, function and configuration are in place.
11. Configure a trusted scheduled invocation of `public.calloria_wa_purge_expired()` if automated retention is required. Until this scheduler exists, retention eligibility is recorded but deletion is not automatic.

### Supabase migration

`202611070014_calloria_whatsapp_channel.sql`

This migration creates only `calloria_wa_*` objects and references the existing Phase 12 Contact Routing records. It does not alter Prospector tables, existing authentication triggers, existing shared organization records, or prior CALLORIA phase tables.

**Do not rerun migrations 001–013.** Do not execute migration 014 more than once. Verify the database migration history before applying it.

### Edge Function webhook callback

`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/calloria-whatsapp`

The Meta callback uses GET for webhook verification and signed POST requests for event delivery. Subscribe to the `messages` field. The endpoint processes only the phone number ID matching `CALLORIA_META_PHONE_NUMBER_ID`.

### Supabase Edge Function secrets

Set these under **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `CALLORIA_META_WEBHOOK_VERIFY_TOKEN` | Private string used for Meta's GET webhook challenge |
| `CALLORIA_META_APP_SECRET` | Meta app secret used to verify `X-Hub-Signature-256` |
| `CALLORIA_META_ACCESS_TOKEN` | Server-only Cloud API access token |
| `CALLORIA_META_PHONE_NUMBER_ID` | The one approved/supported Meta sender phone-number ID |
| `CALLORIA_META_GRAPH_API_VERSION` | Explicit supported API version in `vNN.0` format; use the version supported by the Meta app |
| `CALLORIA_WHATSAPP_DATA_KEY` | Random secret of at least 32 bytes for AES-GCM data encryption |
| `CALLORIA_WHATSAPP_LOOKUP_SECRET` | Independent random secret of at least 32 bytes for HMAC contact lookup |

Existing secrets that must remain configured and unchanged:

- `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` — must remain the same value already used by the Phase 8 Agent Desk; WhatsApp creates a compatible encrypted work-item summary.
- `CALLORIA_ROUTING_ACCESS` — existing staff access map; approved WhatsApp staff entries must include `whatsapp` in `channels`.
- `CALLORIA_ALLOWED_ORIGINS` — must include the production CALLORIA origin, e.g. `https://calloria.vercel.app`.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to its Edge Function runtime. Do not expose the service-role key in browser/Vercel public variables.

Generate the new encryption and lookup secrets in a trusted password manager or secret generator. Keep them separate. Do not send them in chat, add them to GitHub, put them in `VITE_*` variables, or reuse the Groq key.

The browser still uses the existing public Vercel variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or the configured publishable key). These are not substitutes for the server-side secrets above.

## Operational controls

- The Meta Business Messaging Policy requires opt-in for subsequent business-initiated messaging, requires businesses to respect opt-outs, and permits non-template replies to a user message only during the 24-hour customer-service window. Outside that window, only approved templates may be sent. This phase blocks free-form sends outside the window and deliberately does not implement templates.
- Keep the WhatsApp Business profile, contact information, service descriptions and business identity accurate. Review Meta's current policy and message pricing for the Nigerian market before launch.
- Do not ask customers for passwords, OTPs, PINs, CVVs, API keys, full card numbers or financial account numbers. The outbound check blocks common credential-request phrases, but it is a safety aid, not a complete content moderation system.
- Do not use this channel for clinical diagnosis or treatment. Route immediate-risk disclosures to trained safeguarding staff and established human escalation paths. Avoid collecting sensitive health details that are not necessary for the requested support.
- Do not repurpose WhatsApp thread information for unrelated profiling, nor expose one customer's messages to another customer.
- Evidence references must point to a real consent record. Do not paste private conversation contents or sensitive details into the reference field.

## Verification boundaries

The package tests the local classification/normalisation utilities and checks source-level security/integration contracts. A passing local test suite does not prove that a Meta Business account is approved, webhooks are subscribed, Supabase secrets are correct, a live sender number is connected, or the Vercel site is deployed.
