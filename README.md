# CALLORIA — Contact Centre Career & Operations Simulator

**Build:** 0.9.0 — Server-backed Identity & Tenant Isolation  
**Product:** A browser-first contact-centre career and operations simulator. Recruitment is the entry gate; the main experience is simulated employment, multi-channel customer operations, workforce routines and career progression.

## What changed in 0.9.0

### Supabase identity and server-side organisation tenancy
- Added Supabase Auth email/password registration, sign-in, password reset and sign-out flows.
- Added a first-owner organisation-creation RPC, verified-email invitation acceptance and role-controlled member invitations.
- Added PostgreSQL organisation, membership, profile, invitation, policy and audit tables.
- Enabled Row Level Security on every exposed tenant table, with organisation-scoped read policies and least-privilege role checks.
- Revoked direct browser writes to tenant membership, organisation, invitation, policy and audit tables. Mutations run through security-definer RPCs with explicit membership and permission checks.
- Added server-side policy validation, staff activation/suspension and tenant audit events.
- Partitioned local gameplay saves by authenticated user and selected organisation to reduce same-browser cross-account/save collisions.
- Added a strict cloud access gate: when Supabase is partially configured or unavailable, the application does not silently fall back to local demo mode.

### Operational boundary
This milestone server-backs identity and organisation administration only. Recruitment progress, gameplay, simulated call records, customer interactions, shift records, voice sessions and performance history remain browser-local. Staff invitations create pending records but do not send emails; recipients must create/confirm an account using the invited email and accept the invitation. The SQL has static regression coverage but has not yet been applied to a live Supabase project or subjected to live cross-tenant RLS testing. Do not describe a deployed environment as security-verified until the tenant-isolation checklist has passed against the actual project.

### Supabase setup
See `SUPABASE-SETUP.md` before configuring Vercel. Run the migration in `supabase/migrations/202611070001_calloria_server_tenancy.sql
supabase/migrations/202611070002_calloria_employment_persistence.sql`, then add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Vercel environment. A legacy anon key is supported. Never put a service-role or secret key in a `VITE_` variable.

## What changed in 0.8.0

### Organisation administration foundation
- Added multiple local organisation workspace profiles with an active-workspace selector.
- Added an organisation staff directory with synthetic invitations, department assignment and owner/admin/manager/supervisor/QA/agent/trainee role definitions.
- Added explicit least-privilege permission maps for organisation, member, case, report, operations and audit capabilities.
- Added local member activation/suspension controls and duplicate-email validation within each organisation.
- Added configurable organisation policy values for voice and digital response targets, QA pass mark, promotion threshold, concurrent chat target and retention period. The digital response target is applied to newly generated digital contacts; other policy values are currently configuration references.
- Connected the configured promotion threshold to promotion eligibility and examination entry.
- Added administrative audit history for workspace creation, staff invitations, status changes and policy updates.
- Added tenant-scoped snapshot retrieval and independent policy/member/audit records per local workspace.

### Important enterprise boundary
This is a browser-local multi-workspace administration foundation. It is not production multi-tenancy: there is no server-side tenant isolation, authentication, invitations by email, user provisioning, database persistence, API authorisation or cross-device synchronisation. The role permission map is a training model and is not a security boundary. Do not store real employee or customer information.

## What changed in 0.7.0

### Multi-channel customer support
- Added a digital operations desk for synthetic email, live-chat and social-media enquiries.
- Added six scripted sample contacts across the three channels, including a public POS complaint, a mobile access issue, a transfer investigation and service feedback.
- Added priority-aware sorting, channel filters, specialist routing groups, assigned-agent records and queue refresh.
- Added conversation threads, editable channel-specific response starters, agent replies and optional scripted customer follow-up.
- Added explicit after-contact dispositions: resolved, pending customer and escalated.
- Added mandatory factual notes, CRM case creation and preserved digital transcript details when the interaction is closed.
- Added separate channel workload, first-response, response-target risk, resolution, escalation and practice-QA metrics.
- Added digital activity to the overall performance dashboard and promotion KPI input.

### Privacy and customer protection
- Blocks agent replies that explicitly request a PIN, password, one-time code or full payment-card number pattern.
- Applies an additional practice check to social responses: full-quality privacy handling requires directing account-specific support to a verified/private channel.
- Encourages agents to acknowledge customers, take ownership, explain a next step and leave a traceable record.
- Customer names, messages, references and interactions are synthetic training data only.

### Practice QA boundary
The digital-response check is deterministic and keyword/rule based. It checks acknowledgement, ownership, next-step clarity and privacy handling. It is not an AI model, a certified QA scorecard or a substitute for human review. The example email, live-chat and social response targets are illustrative game values; they are not contractual or regulatory service levels.

## Preserved capabilities
- Recruitment application, aptitude screening, practical call assessment and employment acceptance.
- 3D workplace exploration, desktop movement, mobile touch controls and workstation interaction.
- Prioritised inbound voice queue, scripted calls, hold/resume, transfer, supervisor requests and after-contact work.
- Outbound campaigns, callbacks, suppression controls and dispositions.
- CRM case history, operational event timeline, knowledge base, performance and career views.
- Morning and afternoon briefings, specialist department assignment, annual promotion attempts, cross-selling, commendations and synthetic enterprise-system workflow records.
- Optional consent-based voice practice, local recording, speech recognition where supported and agent shift-state animation selection.
- Shift schedule, breaks, adherence, coaching and shift history.

## Operating model

The simulation clock advances 30 in-game seconds for each real second. A full nine-hour shift therefore takes 18 real minutes when left running continuously. The player begins at 07:00, can attend the 07:30 morning briefing, and may start the scheduled shift from 08:00. The 14:00 afternoon briefing is available in its scheduled in-game window.

Default break windows are 10:00–10:15, 12:30–13:00 and 15:00–15:15. The player must manually start and end each break. Break adherence is calculated against the configured schedule. An agent must complete the active call or digital conversation before taking a break or ending the shift.

## Multi-channel workflow

1. Start the simulated shift and open Digital.
2. Filter the queue by Email, Live chat or Social media, or inspect all channels.
3. Accept a priority-routed synthetic customer contact while the agent is available.
4. Read the customer thread and channel handling guide.
5. Write a reply. Unsafe credential solicitation and full payment-card-number patterns are blocked.
6. Receive the scripted customer follow-up where one is available.
7. Complete after-contact work using a resolved, pending-customer or escalated disposition and factual notes.
8. Review the resulting CRM case and channel metrics in the Cases and Stats views.

A digital interaction occupies the agent until it is completed or placed into a documented pending-customer/escalation disposition. The current version does not simulate several concurrent chats for one agent.

## Build and hosting

Requires Node.js 22.12 or later. The application is configured for Vite production builds and Vercel hosting.

Vercel settings:

- Framework: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

The project includes automated syntax and regression checks in its package scripts. The deployment guide uses GitHub Desktop and the Vercel dashboard for the GUI-based release path.

## Simulation and privacy boundaries

- All people, customers, conversations, platform messages, cases, accounts, campaigns, callbacks, salaries and performance values in the simulation are synthetic gameplay data.
- The digital operations desk does not connect to Gmail, Outlook, Instagram, Facebook, X, WhatsApp, live chat providers or other external channels.
- The enterprise systems sandbox does not connect to real ICC, CRM, Finacle or other bank systems and cannot initiate real transactions.
- The application does not place real telephone calls or connect to live customer queues.
- In cloud mode, authentication, organisation membership, organisation profiles, invitations, policies and administrative audit records are stored in Supabase and are intended to be guarded by the supplied PostgreSQL Row Level Security migration after it has been applied. The complete synthetic employment simulation snapshot is synchronised to a tenant-scoped PostgreSQL record for the signed-in user. Local storage remains a fast working cache; Supabase is loaded first when a cloud snapshot exists. Cloud writes are debounced and retried while the page remains open. Existing unscoped local/demo progress is not automatically imported into a cloud-scoped profile; the previous browser save remains separate.
- Optional audio samples and transcripts remain in page memory only and are not persisted in the employment save. Browser speech recognition may use a browser-controlled recognition service; this is disclosed before use.
- Do not use real customer data or enter PINs, passwords, OTPs, full account numbers or payment-card details during practice. The response filter is defensive and is not guaranteed to detect every unsafe phrase or number format.
- Voice practice does not drive customer scenario branching or automatic voice QA scoring.
- Digital practice scoring is deterministic and must not be treated as an approved organisational scorecard.
- GLB animation switching depends on compatible clips in the selected character asset. External model licensing, loading, CORS and animation coverage remain to be verified.
- This is a development simulator, not a finished commercial product or a certified contact-centre workforce platform.

## Project structure

```text
CALLORIA-v1.0.0/
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── vercel.json
├── js/
│   ├── cloud-platform.js
│   ├── cloud-employment-sync.js
│   ├── cloud-security.js
│   ├── organization-engine.js
│   ├── main.js
│   ├── operations-engine.js
│   ├── multichannel-engine.js
│   ├── workforce-engine.js
│   ├── shift-engine.js
│   ├── voice-engine.js
│   └── production-world.js
├── supabase/
│   ├── migrations/
│   │   ├── 202611070001_calloria_server_tenancy.sql
│   │   └── 202611070002_calloria_employment_persistence.sql
│   └── tests/
├── assets/
│   └── calloria-mark.svg
├── tests/
│   ├── cloud-security.test.mjs
│   ├── calloria.test.mjs
│   ├── operations-engine.test.mjs
│   ├── multichannel-engine.test.mjs
│   ├── workforce-engine.test.mjs
│   ├── shift-engine.test.mjs
│   └── voice-engine.test.mjs
└── project documentation
```

## Release verification

- JavaScript syntax checks: passed in the release preparation environment.
- Automated regression tests: 71/71 passed in release preparation.
- ZIP integrity: checked when the release archive is packaged.
- Production dependency installation: timed out in the preparation environment; Vite remains unavailable.
- Vite production bundle: only reported as passed if dependencies are available and `vite build` completes.
- Browser UI, message flow, screen-reader/accessibility behaviour, 3D asset loading, WebGL rendering, and physical-device QA on Android/iOS require browser/device verification.
- No GitHub commit or Vercel deployment is implied by this ZIP package.

Build 1.0.0 adds tenant-scoped persistence for the employee simulation snapshot, including recruitment outcomes, employment profile, shifts, briefings, customer interaction queues and histories, CRM cases, coaching, promotion attempts, cross-sell records, commendations and performance counters. RLS is implemented in the supplied migration, but actual SQL execution, project configuration, browser sign-in, live tenant-isolation tests and production deployment remain external verification steps. This release does not yet server-sync simulated customer operations or employment progress.


## v1.0.0 employment persistence

Apply both SQL migrations in filename order. The second migration creates `calloria_employment_records`, a tenant-scoped snapshot table. Each signed-in employee has one `employment_snapshot/profile` record per organisation. The snapshot includes the current synthetic recruitment/employment and operational state arrays and counters. Client writes are debounced; initial cloud loading replaces the local cache when a server snapshot exists. If no server snapshot exists, the current user-and-organisation-scoped local cache is uploaded once as the initial cloud snapshot.

The browser can read only its own snapshot unless its organisation role has `operations:read`. Writes go through a security-definer RPC that checks active membership and uses `auth.uid()` as the record owner. Direct table writes are revoked. This release does not provide conflict-free multi-device merging: the latest snapshot write wins for a given employee profile. It also does not implement scheduled retention deletion, email invitation delivery, real banking integrations or live customer data.
