# CALLORIA Phase 16 Verification

## Passed

| Check | Result |
|---|---|
| `npm test` across the included Phase 15 and Phase 16 tests | **61 passed, 0 failed** |
| `tsc --noEmit -p tsconfig.edge.json` | PASS |
| `node --check vite.config.js` | PASS |
| `node --check js/web-chat-engine.js` | PASS |
| `node --check js/live-chat-inbox-workbench.js` | PASS |
| `node --check widgets/calloria-chat.js` | PASS |
| `package.json` and `tsconfig.edge.json` JSON parsing | PASS |
| `supabase/config.toml` TOML parsing | PASS |
| HTML duplicate-ID checks on Live Chat, Agent Desk, Email Inbox and WhatsApp Inbox | PASS |
| Required Phase 16 source files and Edge Function-local helper presence | PASS |
| Contract checks for six origins, guest tokens, encryption, RLS, staff assignment, rate limits, atomic message writes and retry idempotency | PASS |

## Not performed

- Full Vite production build. This package is an overlay and does not contain the complete game root (`index.html` and all original application modules/assets). It must be merged into the full Phase 15-integrated CALLORIA repository before running `npm run build`.
- Full repository `npm run check`: attempted, but the overlay lacks the baseline game files and stops at missing `js/main.js`; the full-repository check must be run after merging into the complete Phase 15-integrated repository.
- Live execution of migration `202611080016_calloria_web_chat.sql` against the shared Supabase project.
- Live Edge Function deployment, secret validation or browser-origin/CORS test.
- End-to-end guest-to-agent reply test from the six external product deployments.
- Embedding the widget into the six separate product repositories or deploying any Vercel site.

## Scope and compatibility

- Baseline: Phase 15-integrated CALLORIA source package.
- New migration: `202611080016_calloria_web_chat.sql` only.
- New Edge Function: `calloria-web-chat`.
- Earlier migrations are prerequisites and must not be rerun.
- Existing Prospector objects, authentication triggers, Groq secrets, WhatsApp credentials, Resend credentials and Agent Desk encryption key are not intended to be changed.
