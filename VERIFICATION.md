# CALLORIA Phase 12 verification report

## Checks completed in the Phase 12 overlay workspace

| Check | Result |
|---|---|
| Routing engine unit tests | PASS — 11 tests |
| Page, Edge Function and SQL contract tests | PASS — 11 tests |
| Total focused tests | PASS — 22 passed, 0 failed |
| `routing-engine.js` syntax | PASS |
| `support-router-workbench.js` syntax | PASS |
| `routing-control-workbench.js` syntax | PASS |
| `agent-desk-workbench.js` syntax | PASS |
| `vite.config.js` syntax | PASS |
| `tsc --noEmit -p tsconfig.edge.json` | PASS with the included Deno and Supabase module declarations; this is static checking, not a Deno deploy/runtime test |
| `package.json` JSON parse | PASS |
| `supabase/config.toml` TOML parse | PASS |
| Customer Router, Routing Control, Agent Desk and Customer Care HTML parsing; no duplicate IDs on checked pages | PASS |
| HTML ID uniqueness on new pages | PASS |
| New routing CSS brace-balance checks | PASS |
| Vite entry list preservation | PASS by static inspection: Phase 11 pages retained and both Phase 12 pages added |
| Edge Function security/config contract checks, including HMAC rate fingerprint and base customer-care skill | PASS by static inspection |
| Agent Desk direct-claim bypass guard, explicit release control and release/escalation requeue | PASS by static inspection |
| SQL object namespace, RLS revocation, service-role grants, row locks, direct-claim guard, release/escalation requeue and work-item status sync | PASS by static inspection only |
| ZIP archive test | PASS |

## Not performed / not claimed

- Full `npm run build` against the complete user's Phase 11-integrated CALLORIA checkout. The overlay workspace does not include the full 3D simulator source tree or every previously integrated phase file.
- Full pre-existing CALLORIA test suite from the current GitHub working tree.
- Running migration 013 against the shared Supabase database or a PostgreSQL parser/runtime.
- Deploying `calloria-contact-routing` or testing with real staff Auth UUIDs.
- Testing the shared Agent Desk encryption key against existing encrypted production records.
- Browser end-to-end testing, desktop/mobile QA or Vercel deployment.
- Actual telephony, carrier, email, WhatsApp, social inbox or live-chat provider integration.

## Integration and security checks

- New database objects are limited to `calloria_route_*`, plus a trigger on the existing Phase 8 `calloria_ops_work_items` table to mirror resolved/cancelled status. No Prospector-specific table, trigger, policy or credential is modified.
- Direct `anon` and `authenticated` table privileges are revoked; RLS is enabled; privileged operations are exposed only through service-role functions called by the Edge Function.
- Public submissions require explicit storage consent, are rate-limited by a salted connection fingerprint and contain no contact-detail input fields.
- Request narratives are encrypted using the existing Agent Desk HKDF/AES-GCM derivation and existing `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET`, so Agent Desk can decrypt the item. A separate routing encryption key must not be introduced.
- The raw customer access token is returned once; only its SHA-256 hash is stored.
- Routing claims lock both the routing row and Agent Desk work item and use `SKIP LOCKED` to prevent double claims. A database trigger also blocks the older generic Agent Desk claim RPC from claiming `CR-` guest requests unless the dedicated routing RPC sets its transaction-local authorization flag. Agent Desk releases and escalations requeue the guest request, and resolved/cancelled outcomes update the customer status tracker. Staff eligibility is checked against the server-side routing map, department, skills, channel, language, matching-department active Workforce shift and current `customer_work` activity. Simultaneous claims by one employee are serialised before concurrency is checked.
- Completed/cancelled work in Agent Desk updates the customer's route status. Closed route records are eligible for opportunistic deletion 180 days after closure.
- The customer status endpoint returns only status, department and creation time. It never exposes the encrypted narrative, internal notes or staff identity.

No claim of live deployment, real database migration success or full-application build success is made in this report.
