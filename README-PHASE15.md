# CALLORIA Phase 15 — Resend Email Support Channel

## Scope

Phase 15 adds a provider-connected email channel to the Phase 14-integrated CALLORIA project. It uses Resend for inbound receiving and outbound customer-service replies. It is an incremental overlay, not a complete replacement repository.

The staff workspace is `/email-inbox.html` and is linked from Agent Desk and WhatsApp Inbox.

### Included

- Resend `email.received` webhook with Svix signature validation over the exact raw request body before JSON parsing.
- Inbound email body/header retrieval through the Resend Receiving API; webhook metadata is not mistaken for full email content.
- Strict routing only for the exact receiving addresses configured in `CALLORIA_EMAIL_INBOUND_ADDRESSES`.
- Email parsing, safe HTML-to-text conversion, common-language detection for English, Hausa, Yoruba, Igbo and Nigerian Pidgin, and heuristic routing across all six RuffNeck products plus customer-care topics.
- Automatic Contact Routing creation/attachment using the existing Phase 12 route creation flow and Phase 8 Agent Desk encrypted-summary key.
- Email thread matching by RFC Message-ID, In-Reply-To and References; sent Resend Message-IDs are retrieved where available and added to a bounded thread-reference index for subsequent replies.
- AES-256-GCM/HKDF encryption for email addresses, display names, subject, body and attachment metadata. Sender lookup and thread correlation use a separate keyed HMAC.
- Staff sign-in through Supabase Auth and the existing `CALLORIA_ROUTING_ACCESS` map. A staff grant must explicitly include `email`, a permitted department and existing contact-centre skill scope.
- Normal agents must claim the linked Contact Routing item before they can read or reply. Supervisors remain restricted to their department scope.
- Human-authorised, plain-text transactional replies through the Resend API. Replies include `In-Reply-To` and `References` headers to preserve mail-client threading where Message-ID data is available. The optional Reply-To environment value is validated as a mailbox before use.
- A per-staff outbound limit of 20 sends per minute. An ambiguous provider/network result is marked `unknown` and blocks another send on that thread until staff inspect the Resend log. CALLORIA does not automatically retry an ambiguous send.
- Encrypted attachment metadata only. The channel does not download, open, inspect or scan attachment contents.
- Explicit retention purge function: email threads and encrypted message records become eligible after 180 days when no active route remains; webhook idempotency rows after 30 days; send-limit buckets after two days.

### Deliberate limitations

- This release connects Resend, not Gmail, Microsoft 365, Outlook or another existing shared mailbox. Use a Resend-managed `.resend.app` receiving address or a dedicated custom receiving domain/subdomain.
- It handles customer-initiated service emails and agent replies. Email campaigns, bulk marketing, promotional cross-sell, automated follow-ups and unattended outbound email are not implemented.
- Outbound replies are plain text only. HTML email templates, signature management, inline images and attachment sending are not included.
- Attachments are represented by encrypted metadata only. No file download, malware scanning, antivirus verdict, preview or secure-upload processing is provided. Staff must not open unexpected attachments; request files through an approved secure upload method.
- The inbox currently displays up to 100 most recent threads visible to the staff permission scope. It does not implement a full historical export or provider mailbox synchronisation.
- Inbound language/intent classification is heuristic, not AI translation or a definitive assessment. Staff must confirm the actual customer need.
- Resend acceptance is not proof of delivery or that the recipient read the message. Delivery/bounce/complaint status webhooks and in-app deliverability reporting are not included in this phase.
- The retention purge function is not scheduled automatically. Configure a trusted Supabase Cron invocation before treating deletion as automated.

## Integration baseline and files

Base this overlay on the Phase 14-integrated CALLORIA repository. Preserve the existing game files, entry experience, prior phase modules and any local changes.

New files:

- `email-inbox.html`
- `js/email-engine.js`
- `js/email-inbox-workbench.js`
- `styles/email-inbox.css`
- `supabase/functions/calloria-email/index.ts`
- `supabase/functions/calloria-email/email-engine.ts`
- `supabase/functions/calloria-email/deno-globals.d.ts`
- `supabase/migrations/202611080015_calloria_email_channel.sql`
- `tests/email-engine.test.mjs`
- `tests/email-contract.test.mjs`

Complete replacement/merge files included:

- `agent-desk.html` — adds an Email Inbox link and clarifies that live provider-backed channels are handled in their dedicated inboxes.
- `whatsapp-inbox.html` — adds an Email Inbox link.
- `vite.config.js` — preserves the prior multi-page app inputs and adds `email-inbox.html`.
- `package.json` — preserves the Phase 14 scripts and adds syntax checks for the new email browser modules.
- `supabase/config.toml` — preserves prior settings and adds `calloria-email` with `verify_jwt = false`. Resend does not send a Supabase JWT to the webhook; the function validates the Svix signature and independently verifies Supabase Auth for staff requests.
- `tsconfig.edge.json` — includes the new Email Edge Function in static checking.

The Edge Function is self-contained in its folder; deploy the full `calloria-email/` directory, not just `index.ts`.

## Installation sequence

1. Confirm the Phase 14-integrated repository contains Phase 12 Contact Routing, Phase 8 Agent Desk, Phase 14 WhatsApp, the prior application pages and the existing configured staff/security secrets.
2. Merge the included `package.json`, `vite.config.js`, `supabase/config.toml` and `tsconfig.edge.json` with any project-specific changes. Do not replace other repository files wholesale.
3. Add `email-inbox.html`, both `js/email-*` modules, `styles/email-inbox.css`, the full `supabase/functions/calloria-email/` folder and the two email tests. Use the included Agent Desk and WhatsApp Inbox HTML replacements or manually preserve the added Email Inbox navigation links.
4. Check Supabase migration history. Confirm migrations `202611070001` through `202611070014` are already applied. Apply `202611080015_calloria_email_channel.sql` exactly once. Do not rerun earlier migrations.
5. Deploy the complete `calloria-email` Edge Function folder.
6. Set the new secrets listed below in **Supabase Dashboard → Edge Functions → Secrets**. Never put private provider, lookup or encryption keys in Vercel or browser `VITE_*` variables.
7. In Resend, configure an inbound receiving address/domain and add a webhook subscribed to `email.received`. Use the callback URL below. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`.
8. Set `CALLORIA_EMAIL_INBOUND_ADDRESSES` to the exact lower-case email addresses configured to receive CALLORIA support mail. A received message addressed to an unlisted address is rejected from ingestion.
9. Verify the outbound sender domain in Resend and set `CALLORIA_EMAIL_FROM` to a verified sender. Configure `CALLORIA_EMAIL_REPLY_TO` only when a valid, monitored reply mailbox is intended.
10. Add `email` to the `channels` list only for the staff UUIDs authorised to handle email in the existing `CALLORIA_ROUTING_ACCESS` map. Ensure their department, skill and language scopes are accurate. Do not grant a wildcard department to ordinary agents.
11. Confirm `CALLORIA_ALLOWED_ORIGINS` includes the production CALLORIA origin, e.g. `https://calloria.vercel.app`. Deploy the Vercel app only after migration, function and secrets are configured.
12. Configure a trusted scheduled invocation of `public.calloria_email_purge_expired()` if automated retention deletion is required. Until that scheduler exists, expiry is recorded but deletion is not automatic.

## Supabase migration

`202611080015_calloria_email_channel.sql`

The migration creates only `calloria_email_*` tables and RPCs. It references the existing Phase 12 `calloria_route_requests` and `calloria_route_create_request` flow. It does not intentionally modify Prospector tables, shared authentication triggers, existing organization records or prior CALLORIA tables.

**Do not rerun migrations 001–014.** The archive retains a copy of Phase 14 migration 014 for source continuity and regression checks; it is not a new migration and must not be applied again. Confirm the migration history and apply migration 015 exactly once.

## Resend configuration

### Inbound webhook callback

`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/calloria-email`

Subscribe to **`email.received`**. The function requires the Resend/Svix headers `svix-id`, `svix-timestamp` and `svix-signature`; it verifies the raw body before processing.

Resend's inbound webhook payload contains message metadata. CALLORIA then fetches the full received email through the Receiving API before encrypting and storing it. See Resend's [Inbound Email documentation](https://resend.com/features/inbound) and [webhook signature guidance](https://resend.com/changelog/managing-webhooks-via-api).

### Receiving domain safety

You can start with a Resend-managed `<address>@<id>.resend.app` receiving address. For a branded receiving address, configure a dedicated domain or subdomain in Resend. If the root domain already receives mail through Google Workspace, Microsoft 365 or another provider, do **not** replace its root MX records for this integration. Use a separate receiving subdomain (for example, `support.example.com`) and follow the exact MX records Resend displays for that subdomain.

### Supabase Edge Function secrets

Set these new values under **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Server-only Resend API key for receiving retrieval and human-authorised replies |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret (normally begins with `whsec_`) |
| `CALLORIA_EMAIL_FROM` | Verified sender, e.g. `CALLORIA Support <support@your-verified-domain.example>` |
| `CALLORIA_EMAIL_REPLY_TO` | Optional valid monitored reply address |
| `CALLORIA_EMAIL_INBOUND_ADDRESSES` | Exact comma-separated lower-case addresses allowed to enter CALLORIA |
| `CALLORIA_EMAIL_DATA_KEY` | Independent random secret with at least 32 bytes for AES-GCM encryption |
| `CALLORIA_EMAIL_LOOKUP_SECRET` | Separate random secret with at least 32 bytes for HMAC thread and sender lookup |

Existing secrets that must remain configured and unchanged:

- `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` — must remain the exact same value used by the existing Phase 8 Agent Desk so its routed interaction summaries can be decrypted by authorised staff.
- `CALLORIA_ROUTING_ACCESS` — existing staff permission map; authorised email staff must include `email` in `channels`.
- `CALLORIA_ALLOWED_ORIGINS` — must include the deployed CALLORIA origin.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime.

Do not alter or repurpose `GROQ_API_KEY`, the Prospector secrets or any existing provider credentials. Generate both new encryption/lookup secrets independently using a trusted password manager or secret generator. Never send them in chat, commit them to GitHub or add them to Vercel public environment variables.

The browser continues to use the existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or configured publishable key). These public values are not substitutes for server-side secrets.

## Operational controls

- Every inbound request must pass signed webhook validation, exact recipient allowlisting and sender/address validation before it can be stored.
- Full sender address, display name, subject, body and attachment metadata are encrypted at rest. Sender and thread correlation use keyed HMAC values rather than plaintext indexed identifiers.
- The browser renders message content using `textContent`; it does not inject customer-provided HTML into the page.
- Customer messages are attached to the existing department and skill routing system. Agents cannot read or reply until the associated route is assigned to them. Supervisors are limited to their configured departments.
- Outbound is restricted to a staff reply on an assigned email route. It is not a newsletter, marketing, lead-nurture or cross-sell campaign engine.
- If Resend returns an ambiguous timeout/server result, CALLORIA marks it `unknown` and blocks subsequent sends for that thread. Staff must inspect Resend's email logs and recipient mailbox before deciding whether a manual retry is safe.
- A successful Resend API response means accepted by the provider, not delivered, read or acted upon by the customer.
- Do not open unexpected customer attachments. This release only stores attachment metadata and does not perform malware scanning.
- Personal guidance, crisis and other sensitive enquiries continue to follow the existing safeguarding and human escalation policies. Email intake classification is only a routing aid, not a diagnosis or clinical service.
