# CALLORIA Phase 17 Verification Report

## Checks completed in the exported Phase 16 + Phase 17 overlay

| Check | Result | Scope |
|---|---|---|
| Complete included test suite | **81 passed, 0 failed** | All tests shipped in the overlay, including Phases 15–17 channel tests |
| Phase 17 focused tests | **20 passed, 0 failed** | Social classification, redaction, webhook normalization, policy and integration contracts |
| JavaScript syntax | **PASS** | `social-inbox-engine.js`, `social-inbox-workbench.js`, `vite.config.js` |
| Edge Function TypeScript static check | **PASS** | `tsc --noEmit -p tsconfig.edge.json` |
| JSON / TOML parse | **PASS** | `package.json`, `tsconfig.edge.json`, `supabase/config.toml` |
| HTML structure / duplicate IDs | **PASS** | Social Inbox and four modified channel/staff pages; no duplicate IDs |
| SQL namespace and privilege checks | **PASS** | Migration creates only `calloria_social_*` tables, enables RLS, and revokes browser access |
| Concurrent-send guard | **PASS** | One unresolved outbound reply per conversation, plus the staff rate limit |
| ZIP integrity | **PASS** | Phase 17 delivery archive integrity test passed |

## Build limitation

A full Vite production build was attempted but could not run in this exported overlay because the Vite CLI is not installed (`vite: not found`). The overlay does not include the complete CALLORIA game source tree. The repository-wide `npm run check` also cannot run here because base files such as `js/main.js` are supplied by the full repository, not this incremental overlay. This is not evidence that the integrated full repository build passes or fails. Re-run the production build and repository check after integrating the overlay into the complete Phase 16-integrated repository with its normal dependencies installed.

## Not run / not verified

- Full Vite production build against the complete repository.
- Supabase SQL migration against the user's shared project.
- Supabase Edge Function deployment.
- Meta App Review / Advanced Access approval.
- Facebook Page or Instagram Professional account token validity and permission scopes.
- Live Meta webhook signature / delivery.
- Live Messenger or Instagram message send / receipt.
- End-to-end Routing Control claim, staff reply and native Meta inbox confirmation.
- Physical browser / device testing.
- GitHub commit or Vercel deployment.

## Security scope reviewed in source

- Raw Meta webhook request body is HMAC-verified through `X-Hub-Signature-256` before JSON handling.
- Webhook verify token and Meta App Secret are separate secrets.
- Meta account tokens remain server-side Supabase Edge Function configuration.
- Social staff actions require Supabase Auth verification and explicit `CALLORIA_ROUTING_ACCESS` grants containing the `social` channel.
- Conversation access is checked against the linked assigned route and permitted department / skill scope.
- Customer messages and provider-scoped sender identifiers are encrypted with dedicated Social Inbox data keys.
- The new database tables have RLS enabled and no direct `anon` or `authenticated` privileges.
- Provider webhook message IDs and staff idempotency IDs are unique. A partial unique index prevents multiple unresolved outbound sends in one conversation.
- Staff outbound replies are rate-limited to 20 per staff account per minute through the existing Phase 12 routing limiter.
- The standard 24-hour customer-initiated reply window is enforced in the browser, Edge Function and database reservation RPC.
- Uncertain provider sends block further replies pending native Meta inbox review.

These are automated and source-level checks only. They are not a live penetration test, provider certification or deployment verification.
