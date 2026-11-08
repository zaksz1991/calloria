# CALLORIA Phase 16 — RuffNeck Website Live Chat & Self-Service Widget

## Release scope

Phase 16 adds one guest-first, first-party web-chat channel for the six RuffNeck websites and a staff Live Chat Inbox. It extends the Phase 15-integrated CALLORIA project. It is an incremental overlay, not a replacement for the simulator, 3D world, prior support channels or existing application modules.

### Customer experience

- A self-service-first floating support widget is served by CALLORIA at the stable path `/widgets/calloria-chat.js`.
- A separate widget configuration is used on each of the six RuffNeck product websites; the backend derives the product identity from the browser's exact `Origin`, not the customer-supplied product field.
- Guests can use the widget without registration, password or account creation.
- Quick-help cards provide product-specific steps and a link to the relevant platform homepage.
- Customers can begin a private conversation by choosing a topic, language and message, then giving explicit consent to encrypted storage and authorised staff handling.
- The chat does not collect a name, email address or telephone number. Common email, phone, card-like number and credential patterns are redacted before persistence.
- A random 256-bit visitor token is returned once. Only its SHA-256 hash is stored server-side. The browser keeps the token in `sessionStorage`, scoped to that product website and browser tab. Clearing browser session storage or changing devices loses the customer-side session; a new request can be opened.
- Visitor messages are refreshed by polling every six seconds while the widget is open and the page is visible. This is near-live polling, not a WebSocket or carrier connection.
- Each message send uses a client-generated idempotency UUID retained through retries; the database enforces uniqueness per conversation so a retry after an ambiguous network response does not create a duplicate message.
- The customer can continue messaging while the route is queued or assigned. When the route is completed, the widget becomes read-only and the customer may start another chat.

### Routing and staff handling

- Every accepted conversation creates a `live_chat` Contact Routing request and the existing Agent Desk work item in the same database transaction as the initial encrypted message.
- Topic-to-department, skill and priority mapping reuses the approved Phase 12 routing categories. Complaints start high priority. Safeguarding starts urgent and requires the safeguarding skill.
- A small additional keyword safety net can elevate some English, Hausa, Yoruba, Igbo and Pidgin phrases to urgent safeguarding. It is only a conservative routing aid: it is not a complete crisis detector or substitute for trained human review.
- Agents must first claim the interaction through the existing Routing Control page. The new Live Chat Inbox only shows conversations inside the staff member's department and assignment scope. Agent access also checks the approved specialist skill.
- Supervisors can view conversations within their permitted departments. Replies are allowed only while the linked route remains assigned.
- Staff use `/live-chat-inbox.html`. Links are added to Agent Desk, WhatsApp Inbox and Email Inbox.
- The existing `CALLORIA_ROUTING_ACCESS` map must explicitly include `live_chat` for each authorised user. No wildcard is added automatically.

### Privacy and security boundaries

- Message bodies are encrypted at application level using AES-256-GCM with an HKDF-derived key. They are not stored as plaintext in the new message table.
- The initial Agent Desk work-item summary uses the existing Phase 8 HKDF/AES-GCM derivation and the exact existing `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET`, so the Agent Desk can read the routed work item. Do not rotate that existing secret.
- Visitor tokens are random 256-bit hex values; only SHA-256 token hashes are stored. Token checks are constant-time comparisons.
- Public browser origins are exact-allowlisted. The Edge Function also checks the origin against a fixed six-product origin-to-platform map. CORS is not treated as the visitor authentication mechanism; the unguessable visitor token is required for every history or send operation.
- Staff requests require a Supabase Auth user JWT and an explicit server-side `CALLORIA_ROUTING_ACCESS` grant. The function has `verify_jwt = false` because public guest requests share the endpoint; staff authentication is enforced in the handler. Supabase documents the distinction between gateway JWT verification and handler-level authorization in its [Authorization headers guide](https://supabase.com/docs/guides/functions/auth-headers).
- All three new tables have RLS enabled, and direct `anon`, `authenticated` and `public` table privileges are revoked. Only the service role can reach the data through this Edge Function. This follows Supabase's guidance to combine RLS with explicit grants and to protect `SECURITY DEFINER` functions with a pinned `search_path` and narrowed execute grants ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions guide](https://supabase.com/docs/guides/database/functions)).
- Rate limits: five new chats per ten-minute connection fingerprint, fifteen customer messages per minute per session, thirty history fetches per minute per session, thirty staff replies per minute per staff account. Only HMAC fingerprints are persisted; raw client IP is not stored.
- A conversation is limited to 300 messages. Message text is limited to 3,000 characters. Attachments, file uploads, customer names, phone numbers, email addresses, payments and account changes are not supported in this channel.
- All customer text is rendered using `textContent`; message HTML is never injected into the DOM.
- Do not treat browser storage, consent or origin checks as identity verification for a RuffNeck account. This is a conversation support channel, not a login or account-recovery proofing flow.

## Files added

| Package path | Purpose |
|---|---|
| `widgets/calloria-chat.js` | Embeddable, self-service-first widget. Vite emits it at `/widgets/calloria-chat.js`. |
| `live-chat-inbox.html` | Staff inbox page. |
| `styles/live-chat-inbox.css` | Responsive staff inbox styling. |
| `js/live-chat-inbox-workbench.js` | Supabase Auth and staff inbox workbench. |
| `js/web-chat-engine.js` | Browser-side topic, language and self-service catalogue validation used by tests. |
| `supabase/functions/calloria-web-chat/index.ts` | Guest and staff request handler. |
| `supabase/functions/calloria-web-chat/web-chat-engine.ts` | Function-local routing and redaction logic. |
| `supabase/functions/calloria-web-chat/deno-globals.d.ts` | Local TypeScript declarations. |
| `supabase/migrations/202611080016_calloria_web_chat.sql` | Isolated web-chat tables and service-role functions. |
| `tests/web-chat-engine.test.mjs` | Topic, language, safeguarding and redaction tests. |
| `tests/web-chat-contract.test.mjs` | Origin, RLS, routing, widget and staff-scope contract tests. |

### Merged/replacement files

- `agent-desk.html` — adds a Live Chat Inbox navigation link.
- `email-inbox.html` — adds a Live Chat navigation link.
- `whatsapp-inbox.html` — adds a Live Chat navigation link.
- `vite.config.js` — adds the Live Chat Inbox page and a stable, unhashed widget output path while retaining all Phase 15 page entries.
- `package.json` — preserves existing Phase 15 scripts/dependencies and adds syntax checks for Phase 16 modules.
- `supabase/config.toml` — preserves existing function settings and adds `calloria-web-chat` with `verify_jwt = false`.
- `tsconfig.edge.json` — includes the new Edge Function for static TypeScript checking.

The package also retains the Phase 15 source and verification README as references. The included migration 014 and 015 files are historical dependencies; they are not to be run again.

## Installation sequence

1. Use the Phase 15-integrated CALLORIA repository as the baseline. Preserve all user changes and all existing simulator/3D world files.
2. Merge the included `package.json`, `vite.config.js`, `supabase/config.toml` and `tsconfig.edge.json`. Do not blindly replace newer local configuration.
3. Add the widget, page, workbench, stylesheet, Edge Function folder and new tests. Use the included Agent Desk / Email Inbox / WhatsApp Inbox pages or preserve the new Live Chat navigation links in your customised versions.
4. Check Supabase migration history. Confirm migrations `202611070001` through `202611080015` are already applied. Apply **only** `202611080016_calloria_web_chat.sql`, exactly once.
5. Deploy the complete `supabase/functions/calloria-web-chat/` directory. Do not deploy only `index.ts`; the function-local `web-chat-engine.ts` is required.
6. Add the new secrets listed below in **Supabase Dashboard → Edge Functions → Secrets**. Do not add private keys to Vercel or browser code.
7. Add the six exact production product origins to `CALLORIA_WEB_CHAT_ALLOWED_ORIGINS` as a comma-separated list, with no trailing slash and no wildcard.
8. Keep `CALLORIA_ALLOWED_ORIGINS` for CALLORIA staff functions. It must include the production CALLORIA origin used by `/live-chat-inbox.html`, e.g. `https://calloria.vercel.app`.
9. Add `live_chat` to the `channels` array of every authorised user in the existing `CALLORIA_ROUTING_ACCESS` JSON map. Keep their real department, trained skills and languages; do not grant safeguarding to untrained staff. Agents need an explicit department. The map must also retain the `general_customer_care` foundation skill.
10. Ensure the same authorised employee is still present in the existing Agent Desk access configuration where that configuration is used. Keep the permission scopes aligned.
11. Deploy the updated CALLORIA Vercel site after the migration and Edge Function are configured. This publishes `/widgets/calloria-chat.js` and `/live-chat-inbox.html`.
12. Add the appropriate embed snippet from `examples/platform-embed-snippets.md` to each RuffNeck website repository. This is a separate change in each of the six product repositories; this Phase 16 ZIP does not modify those repositories or deploy their frontends.
13. On each product site, preserve the site's existing security headers/CSP and allow only the CALLORIA widget script host and Supabase Function endpoint in `script-src`/`connect-src` where those directives are defined. Do not disable the site's Content Security Policy.
14. Configure the approved Supabase retention invocation for `public.calloria_webchat_purge_expired()` if scheduled deletion is required. The function exists, but this phase does not create a scheduler. Existing route retention and closure rules are preserved.
15. Test at least one guest conversation from each of the six production origins, then claim the routed interaction through Routing Control, reply from the Live Chat Inbox, and confirm the reply appears in the customer's original browser session.

## Supabase secrets

Add these new values under **Supabase → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `CALLORIA_WEB_CHAT_ALLOWED_ORIGINS` | Exact comma-separated six product origins listed below. |
| `CALLORIA_WEB_CHAT_DATA_KEY` | Independent random secret, at least 32 bytes, used for chat message AES-256-GCM/HKDF encryption. |
| `CALLORIA_WEB_CHAT_LOOKUP_SECRET` | Separate independent random secret, at least 32 bytes, used for visitor-rate HMACs and request fingerprints. |

`CALLORIA_WEB_CHAT_ALLOWED_ORIGINS` value:

```text
https://ruffneck-lms.vercel.app,https://ruffneck-prospector.vercel.app,https://ruffneck-connect.vercel.app,https://ruffneck-social-hub.vercel.app,https://kano-run.vercel.app,https://kano-keke.vercel.app
```

Existing secrets that must remain configured and unchanged:

- `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` — the exact existing Phase 8 secret, reused to encrypt the Agent Desk summary. Do not rotate it.
- `CALLORIA_ROUTING_ACCESS` — extend only the authorised staff entries to include `live_chat` and accurate skills/departments/languages.
- `CALLORIA_ALLOWED_ORIGINS` — retain the existing CALLORIA staff origin allowlist.
- Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime.

Do not change `GROQ_API_KEY`, any existing Prospector credentials, the WhatsApp provider secrets or the Resend email secrets. Do not place `CALLORIA_WEB_CHAT_DATA_KEY`, `CALLORIA_WEB_CHAT_LOOKUP_SECRET`, the service-role key or any provider secret in Vercel `VITE_*` variables.

The widget needs only the Supabase project URL and the public anon/publishable key. Those public values are intentionally visible in browser code. They are not private encryption or service-role secrets.

## Embedding on the six product websites

Use the six product-specific examples in `examples/platform-embed-snippets.md`. The generic format is:

```html
<script defer
  src="https://calloria.vercel.app/widgets/calloria-chat.js"
  data-calloria-chat
  data-platform="ruffneck-learn"
  data-endpoint="https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/calloria-web-chat"
  data-anon-key="YOUR_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY"></script>
```

Place it before `</body>` on the corresponding product website. Use the matching `data-platform` from the six examples. The backend still derives and validates the product ID from the exact request origin; the `data-platform` attribute is only a local widget configuration guard.

## Database migration

`202611080016_calloria_web_chat.sql`

Creates only:

- `calloria_webchat_conversations`
- `calloria_webchat_messages`
- `calloria_webchat_rate_limits`
- service-role-only rate-limit, conversation-create, atomic message-write and purge functions

Conversation creation calls the Phase 12 `calloria_route_create_request` function inside a database transaction. That function creates the existing `calloria_ops_work_items` Agent Desk record and `calloria_route_requests` row. The web-chat conversation and first encrypted message are created in that same transaction, so a failed chat insert rolls back the routing work item too.

Subsequent customer and staff messages are written through `calloria_webchat_add_message`. It locks the conversation and linked routing row, verifies that the session and route remain open, rechecks assignment before an agent reply, enforces the 300-message cap, inserts the encrypted message and updates the conversation timestamp atomically. Both visitor and staff retries use a stable client idempotency UUID. Message reads are capped at the same 300-message conversation limit.

The migration references existing Phase 12 routing. It does not re-create or modify the route function, Agent Desk tables, authentication triggers, Prospector tables or any prior customer-care modules.

**Do not rerun migrations 001–015.** Apply migration 016 once only after confirming its Phase 12/15 prerequisites.

## Operational limitations

- The widget is not yet embedded in the six platform deployments; those are six separate repository changes.
- The widget uses six-second polling, not a persistent WebSocket. Background tabs pause polling.
- The widget works only on the six hard-coded RuffNeck production domains and origins enabled in `CALLORIA_WEB_CHAT_ALLOWED_ORIGINS`. Preview deployments, custom domains and localhost are intentionally blocked until explicitly reviewed and added to the origin/product map.
- It is an in-browser conversation. It does not send an email, SMS, WhatsApp notification or push alert when a customer closes the tab.
- If the customer loses the tab/session storage or changes device/browser, they cannot recover that guest token. They can open a new chat.
- This phase has no file uploads, attachments, voice/video calling, remote co-browsing, AI-generated customer replies, marketing broadcasts or payment/account changes.
- The self-service text is a compact static copy of approved Phase 4 guidance. Dynamic pricing, product availability, live account status, course enrolment status and game inventory must still be checked on the respective platform.
- Keyword-based safeguarding detection is incomplete. A customer can still choose the safeguarding topic directly. CALLORIA remains non-emergency support; urgent safety concerns require the approved human escalation process.
- Full Vite application build, live database migration, live Supabase Edge Function deployment, browser-origin testing, end-to-end customer-to-agent testing and Vercel deployment were not performed for this overlay.

## Verification

See `VERIFICATION.md` for exact local checks and the boundary of what they prove.
