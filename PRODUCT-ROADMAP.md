# CALLORIA — Product and Commercialisation Roadmap

## Product definition

CALLORIA is a multi-industry contact-centre career and operations simulator. Recruitment and role assessments are the entry gate. The main game is employment: reporting for shifts, handling inbound and outbound customer work, using enterprise-style applications, meeting service and compliance requirements, collaborating with colleagues and progressing through a career.

## Product pillars

1. **Career simulation:** candidate profile, recruitment, interviews, offers, employment, shifts, pay, performance, promotion and management careers.
2. **Contact operations:** voice, email, live chat, messaging, social support, back-office requests, inbound queues, outbound campaigns and follow-up work.
3. **Customer behaviour:** varied personas, intent, sentiment, context memory, branching dialogue and scenario outcomes.
4. **Enterprise workstations:** CRM, dialler, ticketing, core-business applications, knowledge base, email, chat, workforce management and reporting.
5. **Performance intelligence:** role-specific QA, CSAT, first-contact resolution, AHT, ACW, adherence, conversion, complaint outcomes and compliance gates.
6. **Organisation administration:** tenant setup, roles, departments, policy configuration, scenario authoring, QA configuration and analytics.
7. **Immersive 3D workplace:** authored office architecture, professional character assets, character animation, first-person movement, workstation interaction and environmental audio.

## Current build

### Build 0.3.0 — CALLORIA game-first and mobile interaction upgrade

Implemented in this source package:

- Rebranded all player-facing interface, browser metadata, 3D screen textures, reception signage, and application copy to CALLORIA.
- Replaced the document-style shell with a dark, game-oriented HUD, compact navigation rail, cinematic world stage and in-world immersive overlay.
- Added touch-first movement joystick, camera drag-look, run and workstation-use controls for touch devices.
- Kept keyboard/mouse controls for desktop players and retained the recruitment-to-employment gate and existing customer-operation views.
- Added device-aware rendering defaults for coarse-pointer/mobile devices.
- Introduced Vite production bundling, npm-managed Three.js/addons and a Vercel build pipeline.
- Added migration from the former local browser save key so existing player progress is retained.

**Known boundary:** this is a game-first interface and touch-control upgrade, not a full rebuild of the 3D art assets or completion of the call operations engine. Remote character and reception GLB assets still require first-party hosting and browser verification. Mobile controls are implemented in source but require physical Android/iOS browser testing before the release can be called fully mobile-verified.

### Build 0.2.0 — Professional 3D workplace vertical slice

Implemented in the current source package:

- Rebuilt the earlier primitive room study into a purpose-built contact-centre environment.
- Added 12 detailed workstations across three agent pods, including dual simulated screens, keyboard, mouse, headset, phone, chair, acoustic panels, CPU, desk structure and station indicators.
- Added reception, meeting area, supervisor/QA suite, operations wall display, daylight glazing, ceiling, lighting, surface textures and a branded operations environment.
- Added first-person movement, mouse look, sprint, preview orbit/zoom, workstation proximity and E-key interaction.
- Added runtime GLTF asset loading for two CC0 rigged characters and a CC0 reception-desk model, with local fallback geometry.
- Retained the recruitment and employment gate and the existing inbound/outbound, CRM, knowledge, performance and career application views.
- Added static regression tests and an asset register.

**Known boundary:** remote GLB files are referenced at runtime, not bundled. The current build environment could not independently download and inspect those binaries. Publisher CORS and runtime asset loading still require browser verification. This is a professional 3D vertical slice, not a finished commercial game.

## Industry packs

- Banking and financial services.
- Telecommunications.
- Utilities and energy.
- Retail and e-commerce.
- Logistics and delivery.
- Travel, hospitality and reservations.
- Insurance.
- Healthcare administration (non-clinical customer support only).
- Technology helpdesk and SaaS support.
- Public-service information lines.

Each industry pack must have a separate policy configuration. Procedures, disclosure permissions, consent rules and regulatory requirements must not be assumed to transfer between organisations, industries or countries.

## Banking operations pack informed by the supplied timetable

The banking pack should eventually include configurable procedures and simulations for cashless policy, cheques, IMTO services, Finacle-style core banking workflows, account and consumer products, treasury bills and fixed deposits, FirstMobile/mobile banking, USSD, online banking, BVN validation, e-statements, payment collections, card operations, ATM and POS disputes, Postilion-style switch workflows, CRM, IBPS, Arbiter-style dispute tools, diaspora banking, foreign transfers, Form A, Form M, PTA/BTA, fraud complaints, chargebacks, contact-centre controls and quality monitoring. These names are content targets only; production builds require institution permission, approved system specifications and verified current procedures.

## Channel catalogue

### Inbound

- General enquiries and service navigation.
- Account, product and billing support.
- Technical troubleshooting and helpdesk.
- Transaction, payment and card disputes.
- Complaints, escalations and case updates.
- Retention and cancellation requests.
- Fraud or security incident reporting.
- Order, delivery, booking and reservation support.
- Email, chat, messaging and social inbox handling.

### Outbound

- Customer onboarding and welcome calls.
- Service follow-ups and satisfaction surveys.
- Appointment and delivery confirmations.
- Authorised sales and product campaigns.
- Lead qualification.
- Retention and win-back.
- Renewal and payment reminders.
- Collections where legally permitted and appropriately controlled.
- Case updates and complaint follow-up.
- Market research and customer feedback.

Outbound workflows require campaign purpose, permitted contact basis, suppression lists, frequency controls, contact-hour controls, opt-out handling and audit records configured for the relevant organisation and jurisdiction.

## Release sequence

### 0.3.0 — CALLORIA game-first and mobile interaction upgrade (current source baseline)

- Full CALLORIA brand replacement across visible UI and scene texture labels.
- Game-first visual shell, cinematic world stage, compact game navigation and immersive HUD.
- Touch joystick, drag-to-look, run and workstation interaction controls.
- Vite production build, npm-managed Three.js dependencies and Vercel build configuration.
- Migration of existing FLOORSHIFT local browser progress into CALLORIA storage.

### 0.2.0 — Professional 3D workplace vertical slice (superseded)

- Professionally directed 3D workplace layout and detailed agent workstations.
- First-person floor navigation and workstation interaction.
- Runtime human GLB asset integration with a documented fallback.
- Retained recruitment and existing agent work views.

### 0.4 — Contact-centre operations engine

- Queue lifecycle: offered, queued, accepted, on hold, transferred, warm hand-off, resolved, escalated and abandoned.
- Inbound routing, skill groups, priority, callbacks and service-level simulation.
- Outbound campaign dialler, contact outcomes, opt-outs, suppression and callback scheduling.
- After-contact work, case ownership and interaction timeline.
- Concurrent operations across voice, email and live chat.
- Supervisor presence, assistance and intervention.
- Role-specific KPI and QA scorecards.
- Scenario authoring separated from rendering code.

### 0.5 — Voice, animation and workforce operations

- Browser microphone capture and playback with explicit permission and recording controls.
- Speech-to-text, customer voice playback and bounded conversation evaluation.
- Animation state transitions for standing, walking, sitting, typing, speaking, listening, turning and headset use.
- Agent status, adherence, break and schedule simulation.
- Call recording review and event timeline.
- Team leader, QA and supervisor roles.

### 0.6 — Multi-channel customer experience

- Full email inbox, templates, response handling and case links.
- Live-chat sessions, concurrent chats and escalation.
- Messaging and social-support queues.
- Customer context continuity across supported channels.
- Customer behaviour engine with controllable personas, sentiment and scenario memory.

### 0.7 — Organisation platform

- Secure authentication and multi-tenant data model.
- Organisation, departments, teams and role-based permissions.
- Admin console for products, scripts, policies, scorecards and campaigns.
- Audit trail, configurable retention and reporting exports.
- Server-backed employee profiles and progression.

### 1.0 — Commercial release candidate

- First-party, version-pinned and licensed 3D assets; no production dependency on third-party model URLs.
- Character animation, facial expression and lip-sync appropriate to selected characters.
- Accessibility, localisation and device QA.
- Security review, privacy impact assessment and penetration testing.
- Load testing and real-time collaboration validation.
- Institution-specific content approval and legal review.
- Subscription, licensing and tenant provisioning.
- Performance budgets and supported-device matrix.
- Documented operational support and release process.

## Production architecture target

- **Client:** TypeScript, React/Next.js and Three.js for browser-first delivery; assess Unreal Engine only if visual requirements exceed a realistic web performance budget.
- **Simulation domain:** versioned scenario definitions, deterministic scoring rules, event history and simulation state engine.
- **Server:** authenticated API services with organisation-scoped access checks.
- **Data:** PostgreSQL with tenant isolation, audit events and policy versioning.
- **Realtime:** queue, presence and supervisor activity updates.
- **Media:** secure, consent-based audio storage and retention.
- **AI:** bounded customer dialogue and agent-assist services with deterministic policy guardrails and human-authored scenario constraints.
- **3D pipeline:** Blender-authored assets, GLB delivery, PBR material standards, rig validation, animation retargeting, LODs, instancing, texture budgets and a first-party asset CDN.
- **Deployment:** CDN/static frontend plus secured backend services.

## Non-negotiable safety and realism requirements

- No real financial transactions or access to real customer accounts.
- No use of production customer data in public or shared scenarios.
- No real outbound calls from the game.
- Never request or display PINs, passwords or one-time passcodes as agent tasks.
- Security, consent and lawful-contact violations must be explicit hard gates.
- AI dialogue must not invent official product charges, rates, laws, regulatory rules or guaranteed outcomes.
- Scores and targets must be role-specific and configurable by authorised administrators.
- Audio recording must be transparent, permission-based and subject to retention controls.
- All industry packs require owner-approved policies and procedures.

## Immediate next engineering priorities

1. Browser-verify all three external GLB assets, CORS, skeletons, materials, scale and animation clips; then move approved versions to first-party hosting.
2. Establish a visual QA pass on representative desktop and integrated-GPU devices; set a minimum frame-rate and texture-memory budget.
3. Complete employee animation states for sitting, typing, speaking, listening and transitions.
4. Separate operational simulation data and state from rendering code.
5. Implement inbound queue routing, callbacks, dispositions and after-contact work.
6. Implement outbound campaign lifecycle, consent controls and contact outcomes.
7. Add multichannel email and chat, then supervisor and QA workflows.
8. Replace illustrative KPIs with versioned role-specific scorecards.
9. Add a server-backed tenant-scoped account and save system before any commercial pilot.
