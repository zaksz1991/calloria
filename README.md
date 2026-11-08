# CALLORIA Phase 19 — Termii SMS Support

Phase 19 adds a restricted, one-to-one Nigerian SMS support channel to the Phase 18-integrated CALLORIA codebase.

## What this phase adds

- A staff-only SMS inbox at `/sms-inbox.html`.
- Termii inbound SMS webhook processing and delivery-report updates.
- Routing into the existing CALLORIA Contact Routing and Agent Desk queues.
- Classification for the full RuffNeck portfolio: Learn, Prospector, Connect, Social Hub, Kano Run and Kano Keke.
- Support routing for platform/account access, technical issues, complaints, sales enquiries, personal guidance, learning/career and safeguarding.
- Conservative English, Hausa, Yoruba, Igbo and Nigerian Pidgin language hints; agents must confirm language with customers.
- One-to-one support replies only, using Termii's `dnd` channel. There is no bulk send or `generic` promotional fallback.
- Staff access through Supabase Auth plus the existing `CALLORIA_ROUTING_ACCESS` permissions map.
- SMS sender and body encryption, keyed phone lookup, webhook signature verification, idempotency and delivery-status tracking.
- `STOP` / `START` / `HELP` command handling and CALLORIA-local opt-out enforcement.
- Character-encoding and segment estimate in the composer (GSM-7 or UCS-2). This is an estimate, not a billing quote.
- Recovery of outbound records stuck in `sending`: after three minutes they become `unknown`. The inbox blocks unsafe retry until staff checks Termii delivery records.

## Important scope boundaries

This is a source integration package, not an activated Termii account or deployed CALLORIA service. No provider API key, sender ID, account balance, paid plan, Supabase migration or Vercel deployment was created or changed here.

CALLORIA SMS is not a marketing channel. Only a customer-originated support interaction may receive a one-to-one service response. The implementation is capped at one Nigerian mobile recipient per send, rejects promotional content, and uses the provider's `dnd` route only after that route is explicitly enabled by provider confirmation. It never silently falls back to `generic`.

The SMS composer estimates message segments because the GSM-7 and Unicode encoding paths have different segment capacities. Actual carrier/provider segmentation and charges depend on the submitted message and provider/network processing; the UI does not calculate a monetary price.

### Two different STOP mechanisms

- `STOP` received by CALLORIA creates a CALLORIA-local suppression record and blocks CALLORIA outbound SMS. `START` can clear a keyword-based CALLORIA suppression, but a fresh customer-originated message must follow before the next staff reply. `START` does not grant marketing consent. A staff-imposed suppression cannot be removed by customer `START`.
- Nigeria's network-level Do-Not-Disturb preference is controlled separately by the NCC short code `2442`. CALLORIA cannot turn off or override a subscriber's NCC DND selection. A CALLORIA `START` message does not change it.

The provider's DND transactional route must be approved/activated by Termii for this specific account. Until then, outbound sending remains disabled by configuration.

## Integration baseline

Merge this overlay into the **Phase 18-integrated** CALLORIA repository. It is not a standalone replacement for the entire game. It does not include the complete original game source or the root `index.html` and other Phase 1–18 application files that are expected to remain in the repository.

Files in this package replace or extend the matching files in the Phase 18-integrated project. Preserve all other project files. In particular, do not replace the main game, `index.html`, original world files, or existing game assets with this overlay.

## Database migration

New migration:

`supabase/migrations/202611080019_calloria_sms_channel.sql`

Before applying it, confirm that CALLORIA migrations `001` through `018` are already present in the shared Supabase project's migration history and that the Phase 18 Contact Routing / Agent Desk schema exists. Apply migration `019` once only. Do not rerun migrations `001`–`018`.

Migration 019 creates only `calloria_sms_*` tables/functions and expands the channel checks on the two existing CALLORIA operational routing tables (`calloria_ops_work_items` and `calloria_route_requests`) to allow `sms`. It does not intentionally change Prospector tables, generic profiles/organisations, existing authentication triggers, or shared access policies.

New SMS tables:

- `calloria_sms_threads`
- `calloria_sms_messages`
- `calloria_sms_suppressions`
- `calloria_sms_preferences`
- `calloria_sms_webhook_events`
- `calloria_sms_send_limits`

All have RLS enabled and direct browser privileges revoked. The Edge Function accesses them with the Supabase service role after doing its own staff authentication and permission checks. Do not place the service-role key in Vercel client environment variables.

The migration also adds service-role-only maintenance functions:

- `calloria_sms_reconcile_stale_sends()` — run by the inbox before queue display. It converts any outbound send left in `sending` for more than three minutes to `unknown`; a new customer inbound is required before a subsequent reply can be reserved.
- `calloria_sms_purge_expired()` — deletes SMS threads/messages after 180 days and minimal webhook fingerprints after 30 days. Suppression and preference records are retained to protect the opt-out. The function is available but this package does not configure a scheduler; create a supported scheduled invocation in Supabase only after reviewing the organisation's retention policy.

## Edge Functions

New function:

`supabase/functions/calloria-sms/`

Deploy `calloria-sms` after applying migration 019.

This package also includes updated copies of the existing Agent Desk, Contact Routing and provider-channel Edge Function folders. Their staff-permission validators now accept `sms` in the channel grant. Deploy these updated copies together with Phase 19, otherwise an existing channel/function may reject the new `sms` permission in `CALLORIA_ROUTING_ACCESS`:

- `calloria-agent-desk`
- `calloria-contact-routing`
- `calloria-whatsapp`
- `calloria-email`
- `calloria-web-chat`
- `calloria-social-inbox`
- `calloria-voice-telephony`

Keep the other function versions and settings intact. The package's `supabase/config.toml` includes `[functions.calloria-sms] verify_jwt = false` because Termii's webhook does not carry a Supabase user JWT; the Edge Function verifies the provider signature itself. Staff actions require Supabase Auth bearer validation inside the function.

## Supabase Edge Function Secrets

Add the following secrets through the Supabase dashboard's Edge Function Secrets UI. Do not add private values to Vercel or commit them to the repository.

| Secret | Purpose |
|---|---|
| `TERMII_API_KEY` | Termii account API key |
| `TERMII_BASE_URL` | Exact account-specific HTTPS API base URL shown by Termii |
| `TERMII_SENDER_ID` | Sender ID approved for the account (3–11 alphanumeric characters) |
| `TERMII_WEBHOOK_SECRET` | Secret Termii uses to sign webhook payloads; confirm the value and signature header with Termii |
| `TERMII_DND_ROUTE_ENABLED` | Set to literal `true` only after Termii confirms that DND transactional routing is enabled for the account; otherwise leave unset/false |
| `CALLORIA_SMS_DATA_KEY` | New independent secret, at least 32 bytes, for SMS phone/body encryption |
| `CALLORIA_SMS_LOOKUP_SECRET` | New independent secret, at least 32 bytes, for keyed phone lookup |

Preserve the existing values of `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CALLORIA_ALLOWED_ORIGINS`, `CALLORIA_ROUTING_ACCESS`, and `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET`. Do not rotate or reuse the Groq key or the WhatsApp, Resend, Meta or Signals provider credentials.

`TERMII_BASE_URL` is account-specific. Use the exact HTTPS host from the Termii dashboard; do not guess a regional hostname. The implementation allows only HTTPS `termii.com` hosts and uses the documented `/api/sms/send` path.

### Staff permissions

In the existing `CALLORIA_ROUTING_ACCESS` secret, preserve every current staff record and permission. Add `sms` to the `channels` array only for employees authorised to handle SMS. Their records still require explicit department grants, supported language grants, appropriate skills, and the common `general_customer_care` skill. A `people_admin` grant cannot read customer message content.

For example, add the channel to a specific existing staff record; do not replace the entire access map with a sample. The supported channel name is exactly `sms`.

## Termii provider setup

1. Activate the Termii account and obtain the API key and the account-specific base URL.
2. Complete sender ID registration/approval for the sender ID you will use.
3. Confirm with Termii that the account can use the DND transactional route for legitimate customer-support responses. Keep `TERMII_DND_ROUTE_ENABLED` false until confirmation.
4. Configure the inbound SMS and delivery-report webhook destination as:

   `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/calloria-sms`

5. Configure Termii to send the `X-Termii-Signature` header using the exact webhook signing secret stored as `TERMII_WEBHOOK_SECRET`. Do not assume that the Termii API key is also the webhook signing secret.
6. Confirm the actual inbound SMS and delivery report event formats against the Termii account's webhook documentation/test facility before enabling production traffic. The parser accepts the tested `incoming_sms` / `message_id` field family, but live provider payload shape and delivery are not verified by this package.
7. Verify one inbound support message and its routing entry, one delivery report, an opted-out number, and one reply to a customer-originated message in a controlled test before general activation.

## Operational behaviour

- Incoming SMS is normalised to Nigerian mobile `234` format and encrypted before persistence.
- Sensitive credentials, customer email/phone strings and account/financial-like numbers are redacted from the stored message copy and routing summary.
- `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END` and `QUIT` activate CALLORIA-local suppression.
- `START`, `UNSTOP` and `SUBSCRIBE` clear only a keyword-based CALLORIA suppression; the next separate customer message is required before a support reply. `START` is never marketing consent.
- `HELP` creates a General Customer Care routing request; CALLORIA does not send an automatic outbound reply.
- Agents must claim the work item through existing Routing Control before opening/replying in the SMS Inbox.
- Only messages in a customer-initiated support thread may be answered. Replies are one-to-one and rate-limited to 20 per staff user per minute.
- Unknown provider outcomes are not auto-retried. Staff must check the Termii message log. A stale `sending` record is marked `unknown` after three minutes to prevent a second send while the first might have succeeded.
- This release has no MMS, attachments, broadcasts, bulk messages, automated promotional messages, scheduling, or customer-initiated outbound campaigns.

## Verification boundary

The included checks validate JavaScript syntax, the Edge Function TypeScript project, HTML structure, configuration syntax, package tests and ZIP integrity. They do not execute SQL against your Supabase project, call Termii, verify sender ID/DND route activation, or deploy any source to GitHub/Vercel. The overlay also does not include the complete original game source, so a full repository production build must be run after merging it into the full Phase 18-integrated repository.
