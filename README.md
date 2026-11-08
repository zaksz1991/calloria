# CALLORIA Phase 17 — Meta Social Inbox (Instagram Direct + Facebook Messenger)

## Purpose

Phase 17 adds a provider-connected social customer-care inbox for customer-initiated Instagram Direct and Facebook Messenger conversations. It extends the Phase 16-integrated CALLORIA project. It is an incremental overlay, not a replacement for the simulator, 3D world, Customer Care, Case Desk, CRM, Agent Desk, Workforce, routing or earlier channels.

### What is included

- One authenticated staff inbox at `/social-inbox.html` for two official Meta messaging channels: Instagram Direct and Facebook Messenger.
- Verified Meta webhook handshake and HMAC SHA-256 signature verification against the exact raw request body.
- Separate account configuration for each Page or Instagram Professional account. Provider tokens remain in Supabase Edge Function Secrets.
- Incoming DM messages create or append to a CALLORIA Social conversation and the existing Phase 12 Contact Routing + Agent Desk workflow in one database transaction.
- Routing classifies common messages into Social Media Support, Complaints, Technical Support, Sales or Safeguarding. The routing skill is attached to the request so Phase 12 skill-aware routing still controls who can claim it.
- Agents see only conversations whose linked route is assigned to them. Supervisors see assigned conversations in their permitted departments. Staff claim unassigned work through the existing `/routing-control.html` page.
- Human-written plain-text replies use the configured official Meta Send API endpoint for that account. Outbound staff sends are limited to 20 per staff account per minute.
- Message bodies and provider-scoped customer IDs are encrypted with a dedicated CALLORIA social data key. The customer ID is never returned to the staff browser.
- Provider webhook message IDs and staff client message IDs are deduplicated. A provider timeout is marked `uncertain`; CALLORIA blocks further replies until the agent checks the native Meta inbox. A database-level pending-send constraint prevents two browser sessions from sending separate unresolved replies concurrently.
- The account page and all channel inboxes receive a navigation link to Social Inbox.

## Channel and policy limits

This release handles **customer-initiated DMs only**. It does not ingest or reply to public Page/Instagram comments, publish posts, react to content, send broadcasts, initiate conversations, automate marketing or run an AI auto-responder.

CALLORIA enforces the standard 24-hour customer-initiated messaging window. If the window has expired, the Send button is disabled and the server rejects the reply. This implementation deliberately does not use the Human Agent tag or another policy exception to bypass the standard window. Meta's Messenger Send API describes the Page access token, `pages_messaging` permission and recipient-initiated 24-hour messaging window; Meta's Instagram API collection documents the `instagram_business_manage_messages` permission and customer-initiated messaging requirement for Instagram professional accounts. See the official Meta references below.

Customer messages that contain only attachments are represented by a safe placeholder. CALLORIA does not download, open, store external attachment URLs or scan media in this release. The agent must review attachments in the native Meta inbox. The provider's native account remains the source of truth for media, profile and delivery diagnostics.

## Meta account configuration

The function supports:

- **Facebook Messenger:** Page webhook object `page`, Page ID as `accountId` and `apiNodeId`, `graph.facebook.com` as `apiHost`, and a Page access token with the required messaging capability.
- **Instagram Login:** Instagram webhook object `instagram`, Instagram Professional Account ID as `accountId` and `apiNodeId`, `graph.instagram.com` as `apiHost`, and the Instagram user access token with `instagram_business_manage_messages`.

The configuration also permits the Facebook Login variant for an Instagram Professional account when Meta's app setup and account linkage use that login model: use the linked Instagram Professional Account ID as `apiNodeId`, `graph.facebook.com` as `apiHost`, and the Facebook Login messaging permissions, including `instagram_manage_messages` (plus the Page permissions required by the Meta app setup). For the Instagram Login model, use `instagram_business_manage_messages` and `graph.instagram.com`. Do not copy a Page ID into the Instagram Login account entry. Meta's permissions and App Review requirements are account/login-flow specific and should be confirmed in the current developer dashboard before production approval.

Configure one Meta App and the appropriate Meta products / webhook subscriptions. For production access to customer accounts outside app roles or testers, complete the applicable Meta App Review / Advanced Access requirements. Verify the currently required permission set in the Meta dashboard before submission; Meta can change product labels and app-review requirements.

### New Supabase Edge Function Secrets

Add these values under **Supabase → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `CALLORIA_META_APP_SECRET` | Validates `X-Hub-Signature-256` on Meta webhook POSTs. |
| `CALLORIA_META_VERIFY_TOKEN` | Random verification string used in the Meta webhook GET handshake. |
| `CALLORIA_META_SOCIAL_ACCOUNTS_JSON` | JSON array containing approved Page / Instagram account IDs, API host/node, display label and access token. |
| `CALLORIA_META_GRAPH_API_VERSION` | Optional version string such as `v26.0`; defaults to `v26.0` and is validated before use. |
| `CALLORIA_SOCIAL_INBOX_DATA_KEY` | Independent random secret of at least 32 bytes for encrypted social text and sender identifiers. |
| `CALLORIA_SOCIAL_INBOX_LOOKUP_SECRET` | Independent random secret of at least 32 bytes for HMAC-based customer sender lookup. |

Example `CALLORIA_META_SOCIAL_ACCOUNTS_JSON` structure (replace every placeholder with the real approved account details and access tokens; do not paste real tokens into chat or commit them):

```json
[
  {
    "provider": "messenger",
    "webhookObject": "page",
    "accountId": "FACEBOOK_PAGE_ID",
    "apiNodeId": "FACEBOOK_PAGE_ID",
    "apiHost": "graph.facebook.com",
    "displayName": "RuffNeck Entertainment Facebook",
    "accessToken": "LONG_LIVED_PAGE_ACCESS_TOKEN"
  },
  {
    "provider": "instagram",
    "webhookObject": "instagram",
    "accountId": "INSTAGRAM_PROFESSIONAL_ACCOUNT_ID",
    "apiNodeId": "INSTAGRAM_PROFESSIONAL_ACCOUNT_ID",
    "apiHost": "graph.instagram.com",
    "displayName": "RuffNeck Entertainment Instagram",
    "accessToken": "INSTAGRAM_USER_ACCESS_TOKEN"
  }
]
```

For Instagram Login, use a Business or Creator / Professional account and the correct Instagram Login token and scopes. The account mapping's `webhookObject` must be `instagram`. The example is a configuration shape, not a claim that these assets are already connected.

Existing secrets that must remain configured and unchanged:

- `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` — used only to encrypt the Agent Desk work-item summary.
- `CALLORIA_ROUTING_ACCESS` — add `social` to `channels` only for authorised social agents / supervisors. Grant the specialist skills they are actually qualified to handle, such as `social_support`, `complaints`, `technical_support`, `sales` or `safeguarding`; keep `general_customer_care` as the required foundation.
- `CALLORIA_ALLOWED_ORIGINS` — retain the existing CALLORIA staff origin allowlist.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — supplied by Supabase Edge Functions.

Do not change `GROQ_API_KEY`, Prospector credentials, the WhatsApp provider secrets, Resend secrets, existing agent-desk encryption or earlier channel data keys. Do not put Meta access tokens, the Meta App Secret, the service-role key or the new social encryption keys in Vercel `VITE_*` variables.

## Meta webhook setup

Use this callback URL:

```text
https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-social-inbox
```

Use the exact value in `CALLORIA_META_VERIFY_TOKEN` as the Verify Token in Meta's webhook configuration. Subscribe the Facebook Page / Messenger product to the `messages` event. Subscribe the Instagram webhook object to the `messages` event for the relevant Professional account. Configure the Page and Instagram account to subscribe to the Meta App where the dashboard requires it.

The handler supports `GET` subscription verification and signed `POST` event deliveries. It only processes message events with an external provider message ID. Echoes, unsupported event types and unconfigured account IDs are ignored; invalid signatures are rejected.

## Installation

Use the Phase 16-integrated repository as the baseline. Preserve existing changes and the game source files.

### Files to add

| Package file | Repository destination | Action |
|---|---|---|
| `social-inbox.html` | `social-inbox.html` | Add |
| `styles/social-inbox.css` | same path | Add |
| `js/social-inbox-engine.js` | same path | Add |
| `js/social-inbox-workbench.js` | same path | Add |
| `supabase/functions/calloria-social-inbox/index.ts` | same path | Add and deploy |
| `supabase/functions/calloria-social-inbox/social-engine.ts` | same path | Add |
| `supabase/functions/calloria-social-inbox/deno-globals.d.ts` | same path | Add; static type-check declarations |
| `supabase/migrations/202611080017_calloria_social_inbox.sql` | `supabase/migrations/` | Add and apply once |
| `tests/social-inbox-engine.test.mjs` | `tests/` | Add |
| `tests/social-inbox-contract.test.mjs` | `tests/` | Add |

### Replace with the included merged Phase 16 versions

- `vite.config.js` — retains Phase 16 entries and adds `social-inbox.html`.
- `package.json` — retains dependencies and checks and adds Social Inbox syntax checks.
- `supabase/config.toml` — retains existing function settings and adds `calloria-social-inbox` with gateway JWT verification off because the function has separate webhook signature validation and staff JWT validation.
- `tsconfig.edge.json` — retains earlier Edge Function checks and adds the Social Inbox function.
- `agent-desk.html`, `whatsapp-inbox.html`, `email-inbox.html`, `live-chat-inbox.html` — the existing Phase 16 pages with a Social Inbox navigation link; the Agent Desk disclaimer now directs external social messages to the dedicated provider inbox.

### Supabase migration and function deployment

1. Confirm migrations `001`–`016` are already applied. Check the migration history first; do not re-run prior migrations.
2. Apply `202611080017_calloria_social_inbox.sql` exactly once.
3. Configure the new Meta and social-inbox secrets above.
4. Deploy the `calloria-social-inbox` Edge Function.
5. Add `social` to the explicit `channels` list for authorised social staff inside the existing `CALLORIA_ROUTING_ACCESS` secret. Add only real staff UUIDs and the skills / departments they are authorised to handle. Do not replace the entire map with placeholders.
6. Subscribe the approved Meta Page / Instagram account webhook objects to `messages`.
7. Confirm the Meta App can deliver a test webhook and the function acknowledges it with HTTP 200 after signature verification.
8. Send a real test DM from a non-admin test account. Verify that one Social route and one Agent Desk item appear; repeated delivery of the same Meta message ID must not create a second conversation or route.
9. Claim the work through Routing Control during a published shift with `customer_work` activity. Reply from Social Inbox while the standard 24-hour window is open.
10. Confirm the reply appears in the native Facebook / Instagram conversation and in the CALLORIA encrypted message history.

The new migration creates only `calloria_social_*` tables and functions. It calls the existing Phase 12 `calloria_route_create_request` function but does not alter it, any Phase 1–16 table, Prospector objects, authentication triggers, existing RLS policies or existing secrets.

## Operations and privacy

- Only the currently assigned staff member can send a reply. An unassigned route must be claimed through Routing Control first. Outbound staff replies are capped at 20 per staff account per minute.
- The function enforces the 24-hour reply expiry again on the server and in the database; the browser is not trusted for policy enforcement.
- A `sending` or `uncertain` outbound item blocks new sends. Check the native Meta inbox before any follow-up; do not attempt to resend an uncertain message with a new ID.
- Message text and platform-scoped sender identifiers are encrypted using `CALLORIA_SOCIAL_INBOX_DATA_KEY`. The sender hash is HMACed using a separate lookup key. The provider access token remains in Supabase Secrets.
- Message preview and detail render with `textContent`; the UI does not inject customer HTML.
- No profile scrape or collection of unrelated profile information is performed.
- The standard messaging window is the only supported send window. No Human Agent tag, marketing tag, broadcast or contact-import route is enabled.
- The migration does not create a retention scheduler. Keep retention aligned with CALLORIA's existing 180-day route-retention control and configure a reviewed purge process before production use.

## Verification boundary

`VERIFICATION.md` records the checks that were actually run in this package. Local unit, syntax and static-contract tests do not prove that Meta approved the app, a Page / Instagram account has the required permission, a real webhook is delivered, a message is sent or a production browser build is healthy. Full Vite build, live Supabase migration, Meta webhook tests and Vercel deployment must be completed against the complete Phase 16-integrated repository before calling this channel live.

## Official references

- [Meta Messenger Platform — Send API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api) — Page access token, `pages_messaging`, Page message endpoint and recipient-initiated 24-hour requirement.
- [Meta Instagram API — Instagram Messaging / Send API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) — Instagram Professional account requirements, `instagram_business_manage_messages`, user-initiated conversation requirement and supported messaging endpoint.
- [Meta Permissions Reference](https://developers.facebook.com/docs/permissions/) — current permission and App Review requirements.
- [Meta Developer Policies](https://developers.facebook.com/devpolicy/) — consent, user messaging, and data handling obligations.
