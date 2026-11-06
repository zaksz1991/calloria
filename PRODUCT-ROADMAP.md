# CALLORIA Product Roadmap

**Current source baseline:** 0.4.0 — Contact Centre Operations Engine  
**Next milestone:** 0.5.0 — Voice, Character Animation & Workforce Operations  
**Product definition:** A browser-first 3D contact-centre career and operations simulator. Recruitment is an entry gate; the core game is the player's working career and simulated inbound/outbound operations.

## Current baseline — Build 0.4.0

The following capabilities are present in the source package and covered by automated source or domain tests:

### Contact operations
- Inbound queue records with unique contact IDs, queue timestamps, service categories, route groups and priority.
- Priority-first routing for fraud, suspicious activity and security issues, with higher priority for disputes and complaints.
- Contact lifecycle rules for queued, offered, connected, on-hold, transferred, wrap-up, callback, completed, escalated and abandoned states.
- Accept, hold/resume, specialist transfer, return-to-queue and callback return actions.
- Queue visibility with waiting count, wait-age and service-level snapshots.
- After-contact work with required factual notes and constrained final dispositions.
- Future-time validation for callbacks and lifecycle completion tracking.

### Outbound operations
- Simulated campaign attempts with unique references and event history.
- Customer outcome/disposition recording.
- Contact opt-out register that blocks later simulated attempts for a suppressed contact.
- Scheduled outbound callbacks and callback resumption controls.
- Safe cancellation of an unfinished campaign attempt without completion credit.

### Supervision, CRM and performance
- Supervisor assistance requests and a review desk for open requests and escalated cases.
- CRM records containing disposition, notes, owner, channel, quality estimate and event history.
- Shared operational event timeline.
- Queue wait, accepted-contact, service-level and after-contact work indicators.
- Queue and Supervisor destinations from the application navigation and 3D workstation interaction panel.

### Existing game foundation retained
- CALLORIA game-first shell and current 3D contact-centre environment.
- Desktop navigation and mobile joystick/look/run/use controls.
- Applicant application, aptitude and practical call assessment, offer and employment gate.
- Existing scripted inbound and outbound customer scenarios.
- Local CRM, knowledge base, performance, salary/bonus and career progression.
- Vite-managed Three.js dependencies and Vercel build configuration.

### v0.4.0 boundaries
- Queue and supervisor operations are single-player simulation logic, not a live multi-agent automatic call distributor or workforce platform.
- Player data, queue events, callbacks and suppression records remain in browser local storage; there is no server-side account or cross-device synchronisation.
- Customer dialogue remains scripted and scenario-driven. Real voice capture, speech-to-text and generated customer voice are not implemented.
- Email, live chat, social messaging and omnichannel conversation continuity are not implemented.
- Current human and reception GLB models remain external runtime references. Their complete browser loading, animation clips, licensing metadata and commercial deployment suitability remain to be verified; approved assets must be first-party hosted before commercial release.
- A successful local Vite production build and physical browser/device verification are still release requirements.

## Previous release lineage

- **0.3.0 — Game-first and mobile interaction upgrade:** CALLORIA branding, game-first interface, touch joystick, touch camera, run/use controls, Vite and npm-managed Three.js build.
- **0.2.0 — Professional 3D workplace vertical slice:** contact-centre floor layout, workstations, navigation, and initial runtime character/environment asset references.
- **0.1.0 — Functional prototype:** recruitment gate, initial employment flow, scripted inbound/outbound scenarios and starter CRM/career systems.

## Next milestone — Build 0.5.0: Voice, Character Animation & Workforce Operations

### Voice interaction
- Explicit microphone permission and clear recording state.
- Browser-based audio capture and playback for player practice.
- Speech-to-text integration behind a replaceable provider interface.
- Customer voice responses and bounded conversation context.
- Text input fallback where microphone access is unavailable.
- Recording consent, retention and deletion controls. No audio is sent to a third party without clear user consent.

### Character and workplace animation
- Verify and first-party host approved character GLB assets.
- Validate skeleton, scale, material, textures and animation clips.
- Implement character state transitions: idle, walk, sit, stand, type, listen, speak, turn and headset handling.
- Add workstation approach, sit/stand and interaction transitions.
- Add restrained ambient staff behaviour while respecting device-performance budgets.

### Workforce operations
- Agent states: available, busy, wrap-up, break and offline.
- Simulated shift schedule, break windows and adherence.
- Workload and role-specific performance measures.
- Team leader coaching and observation scenarios.

### Acceptance criteria
- A desktop browser can load the 3D scene and approved first-party models without external publisher runtime dependencies.
- Animation transitions can be observed through the intended workstation workflow.
- Microphone permission is optional, explicit and handled safely; a text fallback is available.
- Voice interaction can complete a defined scripted customer scenario and preserve the transcript or event record according to chosen retention settings.
- Agent state and shift records behave consistently across the tested workflows.
- Regression suite and Vite production build pass; desktop and representative Android/iOS layouts receive manual browser QA.

## Build 0.6.0 — Multi-channel Customer Operations

- Functional simulated email inbox with templates, replies, attachments in a controlled sandbox and CRM case links.
- Live-chat sessions, queue assignment, response timers, transfers and escalation.
- Social and messaging support inbox scenarios.
- Cross-channel customer history and case continuity.
- Customer personas with controlled sentiment and scenario memory.
- Distinct SLA, quality and workload settings per channel.

## Build 0.7.0 — Organisation Platform

- Supabase authentication and server-backed player profiles.
- Tenant-scoped organisation, department, team and role model.
- Organisation admin, trainer, supervisor, QA and player roles.
- Configurable products, scripts, policies, scorecards and outbound campaigns.
- Audit trails, data retention settings and report exports.
- Cross-device progress sync with strict organisation-level access control.

## Build 0.8.0 — Multiplayer Contact Centre

- Shared team floor and presence.
- Multiple agents, supervisors and QA users in the same session.
- Queue distribution across simulated agents.
- Team briefings, supervisor coaching and escalation hand-offs.
- Collaborative shift performance and cohort reports.

## Build 1.0 — Commercial Release Candidate

- First-party, version-pinned and properly licensed 3D assets.
- Character animation and facial/lip-sync work validated on supported devices.
- Accessibility, localisation and device QA.
- Security review, privacy assessment and tenant-isolation testing.
- Performance, load and browser compatibility testing.
- Organisation-approved content, product rules and legal review.
- Licensing, subscription and tenant provisioning controls.
- Supported-device matrix, performance budgets and operational support process.

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

Every industry pack requires its own approved procedures, contact permissions, disclosures, privacy requirements and role-specific scorecards. A rule from one organisation or jurisdiction must not be assumed to apply to another.

## Banking pack informed by the supplied timetable

The banking content roadmap includes configurable procedures and scenarios for cashless policy, cheques, IMTO, core banking workflows, account and consumer products, treasury bills, fixed deposits, mobile and online banking, USSD, BVN validation, e-statements, card operations, ATM and POS disputes, payment processing, CRM, IBPS, dispute tools, diaspora banking, foreign transfers, Form A, Form M, PTA/BTA, fraud complaints, chargebacks and quality monitoring. Product names are content targets only; real procedures, charges, rates and system behaviours require verified, organisation-approved documentation and permission.

## Production architecture target

- **Client:** TypeScript, React for application interfaces and Three.js for the browser 3D world.
- **Build:** Vite with locked dependencies and reproducible production builds.
- **Simulation domain:** versioned scenarios, deterministic state transitions, rules, event history and role-aware scoring.
- **Server:** authenticated APIs with organisation-scoped access checks.
- **Data:** PostgreSQL, tenant isolation, auditable event records and policy versioning.
- **Realtime:** queue, presence and supervisor activity.
- **Media:** explicit consent, secured audio handling and retention.
- **AI:** bounded customer dialogue, constrained by organisation-approved policy and authored scenario rules.
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
- Audio recording must be transparent, permission-based and subject to retention controls.
- All institutional procedures require owner approval before production use.

## Immediate priorities

1. Build and browser-verify the current v0.4 source on the target toolchain before considering it a deployed release.
2. Fix and verify callback, disposition and suppression edge cases through executable tests.
3. Audit and first-party host approved GLB assets; verify CORS, skeletons, animation clips, scale and materials.
4. Deliver sitting, typing, speaking, listening and headset animation states.
5. Implement optional, consent-based microphone capture and text fallback.
6. Add workforce states, shifts and adherence.
7. Deliver email and chat workflows in v0.6.
8. Establish tenant-scoped backend and administration before commercial pilots.
