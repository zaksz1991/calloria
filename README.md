# CALLORIA Phase 12 — Guest Support Entry, Skills Routing & Queue Control

**Public page:** `/support-router.html`  
**Staff page:** `/routing-control.html`  
**Supabase Edge Function:** `calloria-contact-routing`  
**Database migration:** `202611070013_calloria_contact_routing.sql`

Phase 12 connects the customer-facing help path to the existing Phase 8 Agent Desk. It adds a guest-first entry form, private request tracking, skills-constrained queue claiming and an internal routing control centre. It does not create a second agent work queue: each accepted request becomes a normal `calloria_ops_work_items` record and is then handled in the Agent Desk.

## What it adds

### Customer support entry

- A guided support entry page covering all six RuffNeck products and games.
- Categories for platform support, account access, technical support, product/service enquiries, complaints, personal guidance, safeguarding, learning/career, social media and general customer care.
- Language preference selection: English, Hausa, Yoruba, Igbo and Nigerian Pidgin.
- Server-side language matching; a request waits if no currently eligible staff profile has the chosen language. The language options do not claim that a trained agent is always available.
- Guest submission without account creation or sign-in.
- Explicit consent before storing a support request.
- No name, email, telephone, account or payment fields in the new routing form.
- A random request reference and one-time 256-bit access code. Only the SHA-256 token hash is stored. The customer must keep the raw code to check status.
- Private status checking with generic customer-safe states. Agent Desk resolution and closure are reflected back to the request status.
- Link from Customer Care to the new support entry page. The included `customer-care.html` is the Phase 6 case-enabled version with this new link; it preserves the Case Desk case creation and tracking controls.

### Skills-based routing

- Requests map deterministically to the approved CALLORIA departments and required skills.
- Queue priority is `urgent`, `high`, `normal` or `low`. Safeguarding starts as urgent; complaints start as high; other categories default to normal.
- Queue order applies 30-minute priority aging to non-urgent work. Older non-urgent requests can rise to high priority, but never outrank urgent safeguarding requests.
- The staff member must match department, required skill, channel and language.
- The staff member must be clocked into a published Workforce shift for the same department and currently recorded as `customer_work`.
- Active, held and after-contact work items count against the staff member's configured concurrency limit.
- A single database transaction locks the selected route and corresponding Agent Desk item, then assigns both. A database guard blocks the generic Agent Desk claim RPC for guest-routed items, so staff cannot bypass the shift, skill, language or concurrency checks. The Agent Desk screen directs staff to Routing Control for unassigned guest requests.
- If an agent releases a claimed interaction or escalates an active one, the Agent Desk clears assignment and it returns to the routing queue. Direct Agent Desk claim attempts remain blocked; the next assignment must pass the full Routing Control eligibility check.
- The routing control centre reports exact queue counts by department and priority, and actual oldest waiting time. It does not invent an estimated wait time.
- Staff use a pull model: an eligible agent chooses **Claim next eligible request**. This phase does not silently push work to staff or auto-assign to an arbitrary person.

### Agent Desk integration

- The Edge Function creates the work item in `calloria_ops_work_items` using the existing Agent Desk schema.
- The request narrative is encrypted using the same HKDF/AES-GCM derivation as the Agent Desk, so the existing Agent Desk can decrypt it. It uses the existing `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` without changing or rotating that value.
- The routing claim updates the existing work item's owner and status. The interaction then appears in the normal Agent Desk queue for the assigned employee.
- When an Agent Desk item is marked resolved or cancelled, a database trigger changes the public routing status to completed or closed.
- New routing events store only the route reference, actor identifier and event category. Customer narratives remain encrypted in the linked Agent Desk item.

## Routing map

| Customer selection | Destination department | Required approved skill | Initial priority |
|---|---|---|---|
| Product / platform support | RuffNeck Products and Platform Support | `platform_support` | Normal |
| Account access | RuffNeck Products and Platform Support | `account_access` | Normal |
| Technical problem | Technical Support and IT | `technical_support` | Normal |
| Product, service or pricing enquiry | Sales and Service Enquiries | `sales` | Normal |
| Complaint | Complaints and Service Recovery | `complaints` | High |
| Personal development / general guidance | Personal Development and Wellbeing Information | `personal_guidance` | Normal |
| Safety / safeguarding | Safeguarding and Trained Human Support | `safeguarding` | Urgent |
| Learning / career development | Learning and Career Development | `learning_advice` | Normal |
| Social media support | Social Media Support | `social_support` | Normal |
| General enquiry | General Customer Care | `general_customer_care` | Normal |

Every routing-enabled staff grant is required to include `general_customer_care` as a foundation skill. Specialist skills, approved languages, channels and departments are additional constraints; all employees still need the same basic customer-care capability.

## Privacy and operational boundaries

- The portal stores the customer's short summary encrypted in the existing Agent Desk work item. Subject fields are redacted for common email, phone, credential, account/card number and token patterns.
- The portal does not ask for contact details. A customer who needs a response by email or phone should use the separate Phase 6 support-case form on Customer Care, which has its own explicit consent and encrypted contact-detail workflow.
- The one-time access code is shown once and is not saved to local storage. Losing it means the customer cannot use the private status lookup for that request.
- Public request submission is limited to eight requests per hashed connection fingerprint per 10-minute bucket; status checks are limited to 24. The rate-limit table stores an HMAC-SHA-256 connection fingerprint, not the raw IP or user-agent.
- Closed routing records and their linked Agent Desk work items are eligible for deletion 180 days after closure. Purging is opportunistic when a customer submits a request or checks status; it is not a guaranteed nightly schedule. Unresolved requests are not automatically deleted by this routine.
- The urgent safeguard priority is a queue rule, not an emergency response. The page clearly tells customers that the portal is not an emergency service or clinical treatment.
- The customer status page displays status only. It does not send email, SMS, WhatsApp, social messages, push notifications or agent replies.
- The public page accepts portal-originated requests and flags Kano Run/Kano Keke requests as the `game` channel. Database routing supports additional channel types for future adapters, but Phase 12 does **not** connect telephony, email, live chat, WhatsApp or social provider APIs.
- Claiming a request does not establish a live call. Staff open the Agent Desk to handle, document, escalate and resolve the assigned work item.
- Internal due targets reuse the Agent Desk's configured priority targets (urgent 5 min, high 15 min, normal 60 min, low 240 min). These are internal queue targets, not customer response guarantees.

## Files included

### Add

| Package path | Repository path |
|---|---|
| `support-router.html` | `support-router.html` |
| `routing-control.html` | `routing-control.html` |
| `js/routing-engine.js` | `js/routing-engine.js` |
| `js/support-router-workbench.js` | `js/support-router-workbench.js` |
| `js/routing-control-workbench.js` | `js/routing-control-workbench.js` |
| `styles/support-router.css` | `styles/support-router.css` |
| `styles/routing-control.css` | `styles/routing-control.css` |
| `supabase/functions/calloria-contact-routing/index.ts` | same path |
| `supabase/functions/calloria-contact-routing/deno-globals.d.ts` | same path; local static type-check support |
| `supabase/migrations/202611070013_calloria_contact_routing.sql` | `supabase/migrations/` |
| `tests/routing-engine.test.mjs` | `tests/` |
| `tests/routing-contract.test.mjs` | `tests/` |

### Complete replacements / merged configuration

- `agent-desk.html` — Phase 11 Agent Desk page with a Routing Control navigation link.
- `js/agent-desk-workbench.js` — Phase 9-compatible Agent Desk workbench that hides generic claim controls on guest-routed requests and directs staff to Routing Control.
- `supabase/functions/calloria-agent-desk/index.ts` — complete replacement with a server-side 409 guard that rejects generic claims of `CR-` work items. Deploy this updated function together with the routing function.
- `customer-care.html` — Phase 6 case-enabled Customer Care page with a Submit / Track Support Request link. It retains the case form and case status lookup; do not replace a newer customised version without preserving those changes.
- `vite.config.js` — Phase 11 multi-page Vite configuration with the two routing page entries added.
- `package.json` — Phase 11 scripts preserved, with checks for the new browser modules.
- `supabase/config.toml` — Phase 11 function entries preserved, with `calloria-contact-routing` added and gateway JWT verification disabled for guest submission.
- `tsconfig.edge.json` — prior staff Edge Function type-check paths retained, with the routing function added.

This is an incremental overlay based on the Phase 11-integrated project. It is not a complete copy of the 3D simulator repository. Do not replace `index.html`, `main.js`, `game.js`, `renderer3d.js`, `ui.js`, `production-world.js`, existing 3D assets, prior database migrations or unrelated Edge Functions with older snapshots from this package.

## Installation

1. Integrate Phases 1–11 first. Confirm the existing Agent Desk, Workforce, Customer Care, Case Desk, Customer 360 and Sales Desk files are present. This phase relies on both `calloria_ops_*` and `calloria_wfm_*` objects.
2. Check Supabase migration history. Confirm the required earlier migrations, especially `007` Case Desk, `009` Agent Desk, `010` Workforce and `012` Sales Enablement, have already been applied. Do not rerun migrations 001–012.
3. Apply `202611070013_calloria_contact_routing.sql` exactly once.
4. Deploy the updated `calloria-agent-desk` Edge Function included in this package, then deploy `calloria-contact-routing`. The Agent Desk update prevents its generic claim endpoint from bypassing Routing Control.
5. Set `verify_jwt = false` for these two handler-authenticated staff functions as supplied; `calloria-contact-routing` also accepts guest submissions, so its handler checks origin and staff JWT for all staff-only actions. The public customer submission is guest-first. Staff actions are separately authenticated in the Edge Function using `admin.auth.getUser(token)` and the server-side access map.
6. Add the required secrets under **Supabase → Edge Functions → Secrets**. Do not put any of these values in Vercel browser variables, source files, GitHub or chat.

### Supabase secrets

- `CALLORIA_ALLOWED_ORIGINS` — use the existing exact-origin allowlist already used by the other CALLORIA customer-care functions. It must include `https://calloria.vercel.app` and only the local origins actually used.
- `CALLORIA_ROUTING_ACCESS` — new JSON map containing the staff IDs, departments, approved skills, supported channels, supported languages and maximum concurrent work.
- `CALLORIA_ROUTING_RATE_SALT` — new random secret recommended for the HMAC-SHA-256 request fingerprint. At least 32 characters. If omitted, the function falls back to the Supabase service-role key as the HMAC key.
- `CALLORIA_AGENT_DESK_ENCRYPTION_SECRET` — the **existing Phase 8 Agent Desk encryption secret**. The routing function must use exactly the same value and HKDF derivation so that Agent Desk can decrypt incoming summaries. Do not rotate it. Do not create a separate routing encryption key for this integration.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function. The service-role key must remain server-side. The existing Groq keys, Prospector credentials and other Phase-specific encryption secrets are not used or modified by this phase.

### Routing access-map example

Replace every placeholder UUID with the employee's existing Supabase Auth UUID. These scopes are examples, not real approved staff assignments:

```json
{
  "<existing-agent-auth-uuid>": {
    "role": "agent",
    "departments": ["RuffNeck Products and Platform Support"],
    "skills": ["general_customer_care", "platform_support", "account_access"],
    "channels": ["portal", "game"],
    "languages": ["en", "ha"],
    "maxConcurrency": 1
  },
  "<existing-supervisor-auth-uuid>": {
    "role": "supervisor",
    "departments": ["*"],
    "skills": ["general_customer_care", "complaints", "safeguarding"],
    "channels": ["portal", "game", "voice", "email", "live_chat", "social", "whatsapp", "back_office"],
    "languages": ["en", "ha", "yo", "ig", "pcm"],
    "maxConcurrency": 1
  }
}
```

Supported role names: `agent`, `supervisor`, `people_admin`. Every routing-enabled employee, including supervisors and people administrators, must have the `general_customer_care` foundation skill plus only their approved specialist skills. Agents need explicit departments; `people_admin` must have `departments: ["*"]`. People administrators can view permitted queue totals but cannot claim customer interactions. Allowed skill names are `platform_support`, `account_access`, `technical_support`, `sales`, `complaints`, `personal_guidance`, `safeguarding`, `learning_advice`, `social_support` and `general_customer_care`. Allowed language codes are `en`, `ha`, `yo`, `ig` and `pcm`. Channels are `voice`, `email`, `live_chat`, `social`, `whatsapp`, `website`, `portal`, `game` and `back_office`.

Only list languages and specialist skills for which the employee has been trained and approved. Do not assign `safeguarding` to staff who have not completed that training. The employee must also be listed in the separate `CALLORIA_AGENT_DESK_ACCESS` map with matching department access. A staff account in Routing Control but not Agent Desk cannot open the claimed work; keep both maps aligned.

## Verification

See `VERIFICATION.md`. Focused tests and static checks are included. A full repository Vite build, live Postgres migration, staff authentication, Edge Function deployment and end-to-end browser checks require the user's actual Phase 11-integrated repository and Supabase project. They are not claimed as completed here.
