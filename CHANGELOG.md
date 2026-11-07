# Changelog

## 0.7.0 — Multi-channel customer operations

- Added simulated email, live-chat and social-media customer queues with channel-specific response targets and specialist routing.
- Added priority-first digital queue sorting, agent assignment and lifecycle states for queued, active, awaiting customer, pending customer, resolved and escalated contacts.
- Added threaded customer/agent message history, editable channel-specific reply starters, scripted customer follow-up and mandatory after-contact disposition with factual CRM notes and retained transcript details in CRM.
- Added privacy controls that block explicit requests for PINs, passwords, one-time codes and full payment-card number patterns before a reply is recorded.
- Added a public-social-response quality check that rewards directing account-specific help to an approved private or verified channel.
- Added deterministic rule-based practice QA dimensions for acknowledgement, ownership, next-step clarity and privacy. This is not an AI or human QA assessment.
- Added channel workload, first-response, SLA-risk, resolution, escalation and QA metrics, with digital results included in the performance dashboard and promotion KPI inputs.
- Added CRM case linkage and operational event history for completed digital conversations.
- Added the Digital navigation item and a matching 3D workstation destination; existing recruitment, voice operations, workforce intelligence and shift controls are retained.
- Added 14 multi-channel engine tests and one application integration test; regression suite now contains 55 tests.
- All customer accounts, platforms, inboxes and messages remain synthetic; no real email or social platform integration is present.


## 0.6.0 — Voice practice, character activity and workforce operations

- Added browser-based customer statement playback using speech synthesis when available.
- Added explicit opt-in microphone consent, local audio capture up to 30 seconds and in-page playback.
- Added optional browser speech recognition and a typed-response fallback.
- Added transcript filtering for credential phrases, account/card details, long payment-card numbers and numeric identifiers.
- Kept audio and transcript data in page memory only; added cleanup on page hide/unload and after interaction completion.
- Added agent states for Available, Busy, Wrap-up, Break and Offline.
- Added 08:00–17:00 shift schedule, three scheduled break windows, adherence calculations and shift history.
- Added single-shift-per-simulated-day enforcement and next-workday advancement.
- Added team-leader coaching records with feedback, action plans, scores and follow-up dates.
- Added agent activity updates to the 3D world; desk GLB animation clips are selected when matching clips exist, with restrained fallback arm motion.
- Added six shift-engine tests and five voice-engine tests; total regression suite now contains 40 tests.
- Clarified that voice capture is practice-only and does not yet drive scenario decisions or automatic voice QA scoring.

## 0.5.0 — Workforce intelligence and enterprise operations

- Added daily 07:30 morning and 14:00 afternoon briefing windows, attendance acknowledgements and local attendance history.
- Added a specialist-unit catalogue covering inbound/outbound voice, email, social, chat, IT, QA, customer experience, fraud/security and back office.
- Added weighted promotion eligibility and annual examination records, enforcing one attempt per calendar year and three total attempts.
- Added consent-, relevance- and eligibility-gated cross-selling records.
- Added customer commendation logging with official customer-relations referral; private benefits are not accepted or recorded as permitted.
- Added a synthetic enterprise systems sandbox for ICC, CRM, Finacle, FirstMobile, USSD, Postilion, JIRA and FCQA.
- Added a People & Systems destination while preserving the recruitment gate and customer operations.

## 0.4.0 — Contact-centre operations engine

- Extracted contact queue, lifecycle transitions, priority routing, callback scheduling and outbound suppression into a dedicated operations engine module.
- Added prioritised inbound queue and routing group presentation.
- Added contact lifecycle recording for queue, offer, connect, hold, resume, transfer, wrap-up, callback, completion and escalation.
- Added active-call hold/resume, specialist transfer, supervisor assistance and return-to-queue controls.
- Added after-contact work with disposition validation, factual case notes and mandatory completion before agent continuation.
- Added inbound callbacks with due-time controls and callback re-queueing.
- Added outbound dial-attempt IDs, wrap-up dispositions, customer opt-out suppression and scheduled callback continuation.
- Added supervisor desk, CRM case history and queue/service-level/after-contact work indicators.

## 0.3.0 — CALLORIA game-first and mobile interaction upgrade

- Rebranded the application shell and visible workplace references to CALLORIA.
- Migrated former FLOORSHIFT local save data to the CALLORIA storage key.
- Added a game-first shell, 3D workplace stage and immersive controls.
- Added touch joystick, drag-to-look, run and workstation-use controls.
- Migrated Three.js to npm-managed imports and added Vite build configuration.

## 0.2.0 — Professional 3D workplace vertical slice

- Added a contact-centre environment, workstations, navigation and runtime character/environment asset references.
- Preserved recruitment, customer scenarios, CRM, knowledge, performance and career views.

## 0.1.0 — Initial functional prototype

- Established recruitment application and assessment flow.
- Added employment offer, initial inbound/outbound scenarios, CRM, knowledge base, performance and career foundations.
