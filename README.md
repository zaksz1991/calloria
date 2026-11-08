# CALLORIA Phase 18 — Nigerian PSTN Voice Channel

Phase 18 adds the first external telephone-network connector to CALLORIA using Signals by PressOne Programmable Voice. It is an incremental overlay on the Phase 17 project, not a replacement for the full CALLORIA game or earlier channel integrations.

## What is included

- A staff-only Voice Operations page at `/voice-console.html`.
- Inbound voice webhook with five language choices: English, Hausa, Yoruba, Igbo and Nigerian Pidgin.
- Six call destinations: RuffNeck Products and Platform Support; Sales and Service Enquiries; Complaints and Service Recovery; Personal Development and Wellbeing Information; General Customer Care; Safeguarding and Trained Human Support.
- Skills, department, language, published-shift and workload eligibility checks before a configured handset is rung.
- New inbound voice interactions created in the existing Phase 12 Contact Routing / Agent Desk workflow.
- Outbound callbacks only when the customer explicitly requested or agreed to the callback, the agent records a traceable consent-evidence reference, and a different supervisor or People Administrator approves it.
- Customer phone number HMAC matching, server-side encryption, masked staff views, provider signature verification, idempotent provider events and call request deduplication.
- Atomic reservation of a single on-call handset and a recheck of agent workload before outbound calls.
- Recording is hard-disabled in the schema and OneML. No `Record` verb is generated.

## Important operating limits

This release is a telephone-network connector, not a full PBX or browser softphone:

- Calls ring a configured staff mobile handset. CALLORIA does not yet use the browser microphone.
- Each department has one designated on-call handset in `CALLORIA_VOICE_RING_GROUPS_JSON`; it is not a multi-agent hunt group.
- The inbound `<Dial>` action reports its result after the handset leg ends. The related Agent Desk item is therefore linked/assigned for post-call work, not presented as a live browser call-control session while the conversation is in progress.
- Hold, mute, transfer, conference, supervisor whisper/barge, live monitoring, call recording, transcription and media streaming are not enabled.
- When no eligible handset is available, CALLORIA creates a queued support route and tells the caller to use online support or call later. This package does not provide a voicemail box or an automatic queue callback.
- Outbound calling is limited to an approved callback tied to an assigned inbound voice case. No cold calling, bulk dialing or automated marketing is included.
- A provider timeout is treated as uncertain. CALLORIA blocks another attempt with the same idempotency request; staff must check the Signals call history before taking further action.

## Files added or updated

- `voice-console.html` and `styles/voice-console.css`
- `js/voice-telephony-engine.js` and `js/voice-console-workbench.js`
- `supabase/functions/calloria-voice-telephony/`
- `supabase/migrations/202611080018_calloria_voice_telephony.sql`
- Updated `vite.config.js`, `package.json`, `tsconfig.edge.json`, `supabase/config.toml`
- Updated Agent Desk, Email Inbox, WhatsApp Inbox, Live Chat Inbox and Social Inbox navigation links
- Phase 18 automated tests in `tests/voice-telephony-*.test.mjs`

## Integration baseline and preservation

Use the Phase 17-integrated CALLORIA repository as the baseline. Merge the listed files and configuration entries into the existing project. Do not replace the entire repository with this overlay. Preserve `index.html`, `js/main.js`, `js/game.js`, 3D assets, earlier operations, Supabase migrations and existing environment variables.

This archive contains migration copies for Phases 14–17 for continuity and regression checks. **Do not execute those earlier migration files again.** Check the Supabase migration history and apply only `202611080018_calloria_voice_telephony.sql`, once, after migrations 001–017 have already been applied successfully.

The migration creates only `calloria_voice_*` objects. It does not update, rename or delete Prospector tables, existing authentication triggers, or earlier CALLORIA tables. Do not rerun migrations 001–017.

## Supabase deployment

1. In the Supabase project used by CALLORIA, confirm migrations 001–017 are present. Apply `202611080018_calloria_voice_telephony.sql` once.
2. Deploy the complete `calloria-voice-telephony` Edge Function folder.
3. Add the new secrets below in **Supabase → Edge Functions → Secrets**. Never place provider credentials in Vercel client-side environment variables or commit them to GitHub.
4. Preserve existing secrets, especially `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET`, `CALLORIA_ROUTING_ACCESS`, `CALLORIA_ALLOWED_ORIGINS` and all existing WhatsApp, Resend, Meta and Groq credentials.
5. In the existing `CALLORIA_ROUTING_ACCESS` JSON, retain every current staff record and existing permission. Add `voice` to the channel array only for trained handlers. They also need the `general_customer_care` skill, their exact department skill, permitted language codes, and the correct role. Supported roles are `agent`, `supervisor` and `people_admin`; `maxConcurrency` must be 1–10.
6. Configure the Signals Voice Application only after the function has been deployed and its webhook secrets have been saved.

### New Supabase Edge Function secrets

| Secret | Required value |
|---|---|
| `SIGNALS_ACCOUNT_SID` | Voice Account SID (`AC` plus 32 hexadecimal characters) |
| `SIGNALS_AUTH_TOKEN` | Voice Account auth token; also signs Signals webhooks |
| `CALLORIA_VOICE_BUSINESS_NUMBER` | A Nigerian E.164 caller-ID number owned and eligible in the Signals project, e.g. `+2342013300117` |
| `CALLORIA_VOICE_PUBLIC_URL` | Exact deployed function URL, without a trailing slash or query string: `https://<project-ref>.supabase.co/functions/v1/calloria-voice-telephony` |
| `CALLORIA_VOICE_DATA_KEY` | New high-entropy secret, at least 32 UTF-8 bytes, for encrypted telephone numbers |
| `CALLORIA_VOICE_LOOKUP_SECRET` | New independent high-entropy secret, at least 32 UTF-8 bytes, for keyed phone-number matching |
| `CALLORIA_VOICE_AGENT_LINES_JSON` | JSON map from staff Auth UUID to an enabled, verified Nigerian mobile handset |
| `CALLORIA_VOICE_RING_GROUPS_JSON` | JSON map from exact department name to one on-call staff Auth UUID |
| `CALLORIA_VOICE_NUMBERS_JSON` | JSON array of the CALLORIA-owned Signals DIDs accepted for inbound calls; it must include the configured business caller-ID number |

Example `CALLORIA_VOICE_AGENT_LINES_JSON` shape (replace the placeholder UUID and number with actual staff data):

```json
{
  "00000000-0000-4000-8000-000000000000": {
    "phone": "+2348031234567",
    "enabled": true
  }
}
```

Example `CALLORIA_VOICE_RING_GROUPS_JSON` shape:

```json
{
  "RuffNeck Products and Platform Support": "00000000-0000-4000-8000-000000000000",
  "Sales and Service Enquiries": "00000000-0000-4000-8000-000000000000",
  "Complaints and Service Recovery": "00000000-0000-4000-8000-000000000000",
  "Personal Development and Wellbeing Information": "00000000-0000-4000-8000-000000000000",
  "General Customer Care": "00000000-0000-4000-8000-000000000000",
  "Safeguarding and Trained Human Support": "00000000-0000-4000-8000-000000000000"
}
```

Example `CALLORIA_VOICE_NUMBERS_JSON` shape:

```json
[
  { "number": "+2342013300117", "label": "RuffNeck Main Customer Care" }
]
```

The placeholders above are examples, not real staff or telephone details. Every ring-group staff UUID must have an enabled agent line, `voice` permission, matching department, required skill, `general_customer_care`, and the selected language. Use the same exact department names shown above. The single-line-per-department design is intentional for this phase.

The Calls API uses HTTP Basic authentication with the Voice Account SID and auth token. Do not substitute a Signals API Bearer key; Signals documents these as separate credentials and APIs.

## Signals Voice Application settings

In the Signals console, create a Programmable Voice application and route the CALLORIA-owned DID to it.

- **Voice URL:** `https://<project-ref>.supabase.co/functions/v1/calloria-voice-telephony?flow=inbound`
- **Voice URL method:** `POST`
- **Status callback URL:** `https://<project-ref>.supabase.co/functions/v1/calloria-voice-telephony?flow=status`
- **Status callback method:** `POST`
- **Fallback URL:** configure a short XML/OneML response hosted on infrastructure separate from the Supabase function. It should say CALLORIA is temporarily unavailable and hang up. Do not point the fallback back to the same function host.

`CALLORIA_VOICE_PUBLIC_URL` must match the exact scheme, host and path that Signals calls. The function uses the configured public URL plus the actual query string to verify `X-Twilio-Signature`. A host, path, port, or query mismatch causes a webhook rejection.

## Provider account, compliance and cost

Signals requires full KYC verification before Developer Mode is enabled. The published Signals Terms of Service (updated 13 October 2026) list a Base plan of **₦500,000 per year excluding VAT**, including one Nigerian number and five simultaneous calls; Nigerian calls are listed at **₦14–₦19.50 per minute including VAT**. Additional numbers are listed at ₦15,000 or ₦25,000 per month depending on provider. Confirm the current order form, taxes, number availability and actual rates with Signals before purchasing or enabling billable traffic.

This package does not create a Signals account, buy a phone number, enable Developer Mode, fund a balance or make a live call. Do not activate paid telephony until the organisation approves the recurring and per-minute charges.

## Security and customer safeguards

- Signals webhook requests are verified using the Voice Account auth token and the exact public URL plus sorted form fields.
- Staff requests require a fresh Supabase Auth user check and explicit `voice` channel grant.
- Customer and agent phone numbers are encrypted before database storage. Staff views show masked values; callback approval uses an HMAC lookup, not plaintext phone numbers.
- Callback evidence must be traceable to the relevant interaction. A different supervisor or People Administrator must approve. Self-approval is blocked.
- Callback approval is tied to the original route, requester and exact phone hash; the authorization is consumed once and expires after seven days.
- The database rechecks shift and capacity inside a staff-scoped transaction. Inbound dial reservation prevents the same configured handset from being rung by two concurrent CALLORIA calls.
- Outbound callback volume is capped at ten reservations per staff member per rolling hour.
- Recording is fixed to `off`; no call media, recording or transcript is persisted by CALLORIA in this phase.
- Provider timeouts are treated as uncertain rather than retried automatically.

## Verification performed

See `VERIFICATION.md`. The complete included Phase 14–18 test suite and Edge Function TypeScript typecheck are run before packaging. SQL has static contract checks, but this overlay has not been applied to a live Supabase database. The full production Vite build cannot be verified from this overlay alone because the repository's base game files and complete installed build environment are not included.
