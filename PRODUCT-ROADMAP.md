# CALLORIA Product Roadmap

**Current release:** 0.9.0 — Server-backed Identity & Tenant Administration Foundation  
**Next milestone:** 1.0.0 — Persisted Employment & Contact-Centre Operations  
**Product definition:** A browser-first 3D contact-centre career and operations simulator. Recruitment is the entry gate; the main experience is simulated employment, customer operations, workforce routines, performance and career progression.

## Release history

Build 0.1.0 established the recruitment and career prototype; 0.2.0 introduced the 3D workplace; 0.3.0 shifted to a game-first CALLORIA shell and touch controls; 0.4.0 added contact-centre operations; 0.5.0 added workforce intelligence; 0.6.0 added voice practice and shift management; 0.7.0 added multi-channel service; 0.8.0 added local organisation administration.

## Current baseline — Build 0.9.0

### Recruitment and career simulation
- Candidate application, aptitude/judgement/security assessment, practical customer-call assessment, interview, offer and employment acceptance.
- Local career profile, experience, salary/bonus values and career progression.
- Annual promotion examination records with one attempt per calendar year and three attempts overall; weighted eligibility checks.

### Contact-centre operations
- Prioritised inbound queues, scripted customer scenarios and contact lifecycle history.
- Hold/resume, specialist transfer, supervisor assistance, return-to-queue and callback handling.
- Outbound campaign tasks, callbacks, opt-out suppression and completion controls.
- After-contact work with factual notes and constrained dispositions.
- Synthetic CRM case history, knowledge base, queue metrics and performance views.
- Synthetic email, live-chat and social-media queues, channel-aware routing, threaded conversations, privacy checks and digital after-contact work.
- Channel-specific response targets, workload, first-response, SLA-risk, resolution, escalation and practice-QA metrics.

### Workforce and enterprise simulation
- 07:30 morning and 14:00 afternoon simulated briefing windows.
- Specialist departments for voice, email, social, chat, IT, QA, customer experience, fraud/security and back office; all staff retain core customer-care responsibilities.
- Weighted promotion eligibility, consent/relevance/eligibility-gated cross-selling and official customer-commendation referral.
- Synthetic ICC, CRM, Finacle, FirstMobile, USSD, Postilion, JIRA and FCQA system activity records.
- Agent states, 08:00–17:00 simulated shifts, scheduled breaks, adherence, shift history and coaching records.

### Voice and 3D workplace
- Optional customer-statement playback through browser speech synthesis.
- Explicitly consented, up-to-30-second local microphone sample recording and in-page playback.
- Optional browser speech recognition with text fallback and sensitive-number/credential filtering.
- Temporary voice data stays in page memory; it is not uploaded to CALLORIA or saved in the employment profile.
- GLB desk animation clip selection by agent state when compatible animation clips exist, with restrained local fallback movement.

### Server-backed identity and tenant administration — 0.9.0
- Supabase Auth sign-up, sign-in, password reset and sign-out.
- PostgreSQL profiles, organisations, memberships, invitations, policy and audit tables.
- RLS policies on every tenant table, organisation-scoped reads and permission-checked database RPCs.
- First-owner organisation creation, verified-email invitation acceptance, member suspension/reactivation and policy updates.
- Tenant invitations are database records only; email delivery is not included.
- Browser saves are partitioned by authenticated user ID and active organisation ID.

### Important 0.9.0 data boundary
Server-backed only after the supplied migration is applied and Supabase is configured: authentication, organisation membership, organisation metadata, invitations, tenant policies and administrative audit history. Recruitment, employment, calls, chat/email/social practice, shifts, briefings, coaching, voice sessions, CRM training cases and performance history remain browser-local. They do not synchronise across devices and are not protected as server records. A live Supabase project, SQL execution, RLS isolation and deployment have not been verified in this release environment.

## Next milestone — Build 1.0.0: Persisted Employment & Operations

- Store employee profiles, recruitment outcomes, employment stages, positions and career history in tenant-scoped PostgreSQL records.
- Persist daily briefings, attendance acknowledgements, shift plans, adherence, coaching and promotion attempts.
- Store voice, email, chat, social and back-office practice contacts with tenant-scoped ownership and assignment.
- Persist customer histories, CRM training cases, dispositions, escalations, callbacks and quality results.
- Connect organisation policy values to server-validated operational workflows rather than only local presentation or practice scoring.
- Add reliable invitation delivery through a trusted server/Edge Function and configured email provider.
- Add account lifecycle controls, account deletion/offboarding, retention enforcement and authorised data export.
- Add automated Supabase integration tests proving tenant A cannot access tenant B and that role escalation, suspended accounts and expired invitations are denied.
- Add data migration/versioning so the move from local simulation records to server records does not silently discard player progress.

## Build 1.1.0 — Shared Contact Centre & Realtime Collaboration

- Shared team floor with authenticated agent presence.
- Multi-agent queue distribution and collision-safe contact assignment.
- Supervisor live queue visibility, monitoring requests and coaching hand-offs.
- Team briefings, announcements, acknowledgements and department-specific updates.
- Team/cohort reporting and workload balancing.
- Realtime permissions, reconnect behaviour, presence expiry and audit history.

## Build 1.2.0 — Commercial Release Candidate

- First-party, version-pinned and appropriately licensed 3D models, animations and audio.
- Validated character rigs, facial/lip-sync animation, LODs and documented device performance budgets.
- Accessibility, localisation and representative desktop/mobile browser QA.
- Security and privacy review, tenant-isolation testing, data retention and deletion controls.
- Organisation-approved training content, policy, scorecards and legal review for every industry pack.
- Tenant provisioning, subscription/licensing, usage limits, support and incident response.

## Industry packs

- Banking and financial services.
- Telecommunications.
- Utilities and energy.
- Retail and e-commerce.
- Logistics and delivery.
- Travel, hospitality and reservations.
- Insurance.
- Healthcare administration (non-clinical support only).
- Technology helpdesk and SaaS support.
- Public-service information lines.

Every industry pack requires approved procedures, contact permissions, disclosures, privacy requirements and role-specific scorecards. A rule from one organisation or jurisdiction must not be assumed to apply to another.

## Production architecture target

- **Client:** Three.js for the 3D workplace and focused application interfaces.
- **Build:** Vite with locked dependencies and reproducible production builds.
- **Simulation domain:** Versioned scenarios, deterministic state transitions, role-aware scoring and event history.
- **Server:** Authenticated APIs and database functions with organisation-scoped access checks.
- **Data:** PostgreSQL, tenant isolation, auditable event records and policy versioning.
- **Realtime:** Queue distribution, presence and supervisor activity.
- **Media:** Explicit consent, secured audio handling and configurable retention.
- **AI:** Bounded customer dialogue constrained by organisation-approved policy and authored scenario rules.
- **3D pipeline:** Blender-authored GLB assets, PBR materials, validated rigs, animation clips, LODs, instancing and first-party asset delivery.
- **Deployment:** CDN-delivered frontend plus secured backend services.

## Non-negotiable safety and realism requirements

- No real financial transactions or access to real customer accounts.
- No real customer data in public or shared training scenarios.
- No real outbound calls from the game.
- Never instruct agents to request or disclose PINs, passwords or one-time passcodes.
- Security, consent and lawful-contact violations are explicit hard gates.
- AI dialogue must not invent charges, rates, laws, regulatory rules or guaranteed outcomes.
- Performance targets must be role-specific and organisation-configurable.
- Audio capture must be transparent, permission-based and subject to retention controls.
- Institutional procedures require owner approval before production use.
