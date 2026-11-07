# CALLORIA Product Roadmap

**Current milestone:** 0.7.0 — Multi-channel Customer Operations  
**Next milestone:** 0.8.0 — Organisation Platform  
**Product definition:** A browser-first 3D contact-centre career and operations simulator. Recruitment is the entry gate; the core experience is the employee's daily customer operations, performance and career progression.

Previous milestones: 0.1.0 functional prototype, 0.2.0 3D workplace, 0.3.0 game-first and mobile controls, 0.4.0 contact-centre operations, and 0.5.0 workforce intelligence.

## Current baseline — Build 0.7.0

### Recruitment and career
- Candidate application, aptitude/judgement/security assessment, practical customer-call assessment, offer and employment acceptance.
- Local career profile, experience, salary/bonus values and level progression.

### Contact operations
- Prioritised inbound queue, simulated customer scenarios and contact lifecycle history.
- Hold/resume, specialist transfer, supervisor assistance, return-to-queue and callback handling.
- After-contact work with required factual notes and constrained dispositions.
- Outbound campaign tasks, callbacks, opt-out suppression and completion controls.
- CRM case history, queue metrics, knowledge base and performance views.
- Synthetic email, live-chat and social-media queues, channel-aware routing, threaded conversations, privacy checks, digital after-contact work and CRM case linkage.
- Digital first-response, workload, QA, resolution, escalation and illustrative response-target metrics.

### Workforce intelligence
- 07:30 morning and 14:00 afternoon simulated briefing windows.
- Specialist departments for inbound/outbound voice, email, social, chat, IT, QA, customer experience, fraud/security and back office.
- Annual promotion examination records with one attempt per calendar year and three attempts overall in the current real-calendar implementation.
- Weighted promotion eligibility, consent/relevance/eligibility-gated cross-selling and official customer-commendation referral.
- Synthetic ICC, CRM, Finacle, FirstMobile, USSD, Postilion, JIRA and FCQA system activity records.
- Agent states, 08:00–17:00 simulated shifts, scheduled breaks, schedule adherence, shift history and coaching records.

### Voice and workplace activity
- Optional customer statement playback through browser speech synthesis.
- Explicitly consented, up-to-30-second local microphone sample recording and in-page playback.
- Optional browser speech recognition with text fallback.
- Sensitive-number and credential phrase filtering before transcript display.
- Temporary in-memory handling, with no CALLORIA upload or local employment-save persistence.
- GLB desk animation clip selection by agent state when suitable clips exist; restrained local fallback arm movement.

### 0.6.0 boundaries
- Voice practice does not currently control scripted conversation branches or contribute automatic speech QA scores.
- Browser speech recognition may be processed by the browser's speech provider. The UI discloses this before permission is granted.
- Customer statement playback depends on available browser speech synthesis voices.
- Animation switching is conditional on the external GLB asset containing compatible animation clips. External model license, CORS, loading and runtime compatibility remain to be verified.
- Queue and workforce logic remain single-player browser simulation; localStorage is not a secure, server-backed employee record.
- No real banking service, customer account, transaction, telephone system, live contact centre or enterprise application is connected.

## Completed milestone — Build 0.7.0: Multi-channel Customer Operations

- Simulated email, live-chat and social-media queues with channel-specific response targets.
- Priority sorting, channel filters, specialist routing and one-at-a-time agent assignment.
- Threaded messages, editable channel-specific reply starters, scripted customer follow-up and explicit digital-contact lifecycle states.
- Privacy controls that block explicit PIN, password, OTP and full payment-card-number solicitation patterns.
- Public-social reply guidance requiring a private/verified channel for account-specific support to obtain full privacy practice credit.
- Rule-based practice checks for acknowledgement, ownership, next-step clarity and privacy.
- Mandatory after-contact disposition, factual notes, CRM case creation and retained conversation transcripts.
- Channel-aware workload, first-response, SLA-risk, resolution, escalation and QA metrics.

### 0.7.0 boundaries
- Email, chat and social accounts are simulated only; no external platform API or mailbox is connected.
- Only one digital contact can be active for the player at a time; concurrent chat handling is not yet implemented.
- There are no attachments, live typing indicators, external media uploads, automated language model responses or platform webhooks.
- Channel service targets and deterministic response checks are illustrative and require organisation approval before any real-world training use.

## Build 0.8.0 — Organisation Platform

- Supabase authentication and server-backed player profiles.
- Tenant-scoped organisations, departments, teams and roles.
- Organisation administrator, trainer, supervisor, QA and player permissions.
- Configurable products, scripts, policies, scorecards, briefings, shifts and campaigns.
- Auditable event records, data retention settings and report exports.
- Cross-device progress sync with strict organisation-level access checks.

## Build 0.9.0 — Multiplayer Contact Centre

- Shared team floor and agent presence.
- Multiple agents, supervisors and QA users in a shared session.
- Queue distribution across agents and supervisor hand-offs.
- Team briefings, live coaching and coordinated escalations.
- Cohort and team-level performance reports.

## Build 1.0 — Commercial Release Candidate

- First-party, version-pinned and appropriately licensed 3D models and audio.
- Validated character rigs, facial/lip-sync animation, LODs and device performance budgets.
- Accessibility, localisation and representative desktop/mobile browser QA.
- Security and privacy review, tenant-isolation tests, audio consent and retention controls.
- Organisation-approved content, policy and legal review for every industry pack.
- Subscription, licensing, tenant provisioning and support controls.

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

- **Client:** TypeScript, React for application interfaces where useful, and Three.js for the 3D workplace.
- **Build:** Vite with locked dependencies and reproducible production builds.
- **Simulation domain:** versioned scenarios, deterministic state transitions, role-aware scoring and event history.
- **Server:** authenticated APIs with organisation-scoped access checks.
- **Data:** PostgreSQL, tenant isolation, auditable event records and policy versioning.
- **Realtime:** queue, presence and supervisor activity.
- **Media:** explicit consent, secured audio handling and configurable retention.
- **AI:** bounded customer dialogue constrained by organisation-approved policy and authored scenario rules.
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
