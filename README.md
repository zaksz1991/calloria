# CALLORIA v6.66 — Live Conversational Outbound Operations

A cumulative upgrade built on the complete v6.65 source archive. v6.66 replaces the quiz-style outbound campaign interaction with a live synthetic customer conversation in the actual agent workspace. Agents now respond in their own words, hear browser-generated customer speech, request supervisor assistance, record customer preferences and complete an auditable after-contact record.

Recruitment and candidate assessment remain the employment entry gate. The main gameplay remains the work of an employed agent: taking inbound and outbound contacts, handling voice and digital customers, working CRM/cases and knowledge resources, completing after-contact work, receiving QA and supervisor intervention, and progressing through a contact-centre career. This is not a training-only conversion.

## v6.66 live conversational outbound operations

- Integrates the existing `js/outbound-campaign-engine.js` directly into the application entry point. The agent's outbound workspace now renders a customer transcript and free-form reply form instead of multiple-choice campaign steps.
- Simulates deterministic customer preferences including open to a conversation, busy, callback requested, declined and do-not-contact. Customer reactions depend on the agent's actual typed response.
- Evaluates identity, campaign purpose, permission to continue, empathy, clarity, next-step explanation, respectful decline and callback handling.
- Flags credential solicitation, unsupported campaign promises and coercive pressure as critical breaches; these interactions require supervisor/compliance review. Customer opt-outs are added to the suppression register and block later attempts.
- Provides browser speech playback for the latest synthetic customer statement and an agent-requested supervisor-assistance action. No real outbound telephone call is placed.
- Requires an explicit synthetic customer acceptance before the product-offer campaign can receive sales credit.
- Persists the conversation transcript, turn scorecards, customer preference/decision, callback status, suppression state and critical breach flags into the simulated CRM case and outbound attempt history.
- Removes the obsolete v4.5 Vite source transformer from the active plugin chain because its source anchors no longer matched the current application. The live outbound feature is now an explicit runtime import, not a conditional build-time text rewrite.
- Adds responsive desktop/mobile conversation UI and seven application integration tests. The package syntax check now checks the outbound conversation engine.

## v6.66 boundaries

- Customer contacts and campaign outcomes remain synthetic game data. The dialler does not connect to a PBX, real telephone network, external dialler, banking system or campaign provider.
- Customer voice playback uses the browser speech synthesis helper. It is not recorded customer audio and does not create a telephone call.
- The feature adds no Supabase migration, secret, environment variable, external provider or package dependency.
- Recruitment and assessment remain the employment entry gate. The core product remains an employed-agent career and operations simulator; the outbound workflow is live simulated agent work, not a training quiz.
- `npm run check` passed. The new outbound engine and integration-focused tests passed. The full repository suite has 1,953 tests: 1,409 passed and 544 failed; comparison against the v6.65 baseline found the same 526 distinct failing test names, with no new failing test names.
- Vite production build, live browser walkthrough and Vercel deployment were not verified. The supplied source snapshot has no installed `node_modules`.

## v6.65 adaptive voice customer behaviour

- Adds the previously missing `js/voice-customer-behaviour-engine.js` module that the cumulative `js/main.js` already imports. This closes a source-level integration gap that would otherwise prevent the application entry module from resolving.
- Gives each accepted simulated voice contact a deterministic customer persona, opening statement, tone, sentiment, patience and a bounded dialogue history.
- Evaluates the agent's guided response or free-form typed/transcribed response for acknowledgement, ownership, security handling, clarity and next-step explanation. The customer replies contextually and sentiment/patience and the call quality adjustment change accordingly.
- Models customer interruptions, including repeat-complaint and time-pressured responses, and records them in the customer conversation and interaction timeline.
- Flags requests for PINs, passwords, one-time codes, CVV/CVC or full payment-card details as critical security breaches, raises supervisor risk and produces a customer security objection. Protective warnings against sharing credentials are not misclassified as requests; mixed responses that still solicit credentials remain critical. Sensitive credential and card values are redacted from stored voice-dialogue messages.
- Supports conditional service-recovery discussion for refunds, reversals, compensation and other remedies. A conditional remedy discussion opens a decision panel; choosing the simulated authority-check path records the negotiation as reviewed. No real approval system is queried, and unsupported guarantees are penalised and sent for supervisor review.
- Enforces an eight-turn agent dialogue limit, keeps the message history bounded, migrates older saved voice-behaviour objects without discarding their available history, and exposes active-call voice-risk indicators in the existing Supervisor Customer Emotion Watch.
- Persists customer sentiment, mood, persona, interruptions, escalation risk and negotiation status through the existing inbound wrap-up and CRM case record.

## v6.65 boundaries

- All customers, dialogue, emotion, queue and negotiation outcomes are fictional local gameplay mechanics. Sentiment and patience are game variables, not validated psychological assessments or real customer analytics.
- The release does not connect to a real telephone network, PBX, dialler, external telephony provider, customer database or banking system. Optional browser microphone recording is local to the page; speech recognition support and processing depend on the browser/vendor. Audio and transcript are not uploaded to a telephone provider.
- No database migration, new secret, environment variable, external service or new package dependency is added.
- The legacy v3.6 inbound-conversation Vite transformer now yields to the v6.65 adaptive voice workflow instead of attempting a stale source rewrite.
- The package's Node test and syntax checks do not establish successful Vite bundling, browser audio compatibility, device performance or a Vercel deployment.

## v6.63 digital first-response SLA control

- Digital contacts keep a first-response deadline based on their saved response target. Default fallback targets are Email 240 minutes, Live chat 2 minutes and Social 20 minutes; valid targets already stored on a contact take precedence.
- At 75% of the response target elapsed, an unanswered contact enters Due soon. If the deadline passes, it becomes SLA breached. The first agent reply ends the timer and permanently records Met target or First response late.
- The same calculation appears on agent assigned-work tabs, the active digital conversation banner, waiting queue rows, supervisor triage rows and supervisor breach totals.
- The engine adds one-time risk/breach/met entries to the contact timeline, digital events and operations timeline. Repeated shift ticks do not duplicate those events.
- The SLA clock uses the existing accelerated shift simulation time. Follow-up customer replies do not restart the first-response timer.
- These are fictional local gameplay targets, not live provider clocks or contractual service levels. No database migration, secret, environment variable, external provider or new package dependency is added.

The v6.66 test and verification record is in `TEST-RESULTS-v6.66.txt`, `VERIFICATION-v6.66.md` and `INSTALL-GITHUB-v6.66.md`. The v6.65 test and verification record is in `TEST-RESULTS-v6.65.txt`, `VERIFICATION-v6.65.md` and `INSTALL-GITHUB-v6.65.md`. The v6.63 test and verification record is in `TEST-RESULTS-v6.63.txt` and `VERIFICATION-v6.63.md`; GUI merge steps are in `INSTALL-GITHUB-v6.63.md`.

## v6.62 unified agent workload and digital concurrency

- Agents can keep up to three active digital responses assigned at once, with channel caps of two email threads, two live chats and one social conversation. The global three-item cap applies across all digital channels.
- An assigned-work tab strip lets agents switch between conversations without losing the current thread. A compact queue remains available in the thread workspace so additional work can be accepted while capacity is available.
- When an agent replies and the contact moves to Awaiting Customer, it remains on the assigned list but frees an active response slot. A customer follow-up must pass the capacity checks before it becomes active again.
- The same workload checks prevent digital acceptance during voice, outbound or after-contact work and outside an active shift.
- Older single-thread browser saves are migrated to the multi-contact representation. Agent status is recalculated as contacts are accepted, moved to customer-waiting, resumed or completed.
- Supervisor metrics distinguish active digital responses from assigned contacts waiting for customers.
- Responsive layouts provide work tabs, capacity indicators and queue actions on desktop and phone widths.

All records remain fictional local simulation data. The feature does not connect to live email, social or messaging providers. Limits are simulator rules, not contractual staffing standards. The new tests and verification boundary are recorded in `TEST-RESULTS-v6.62.txt` and `VERIFICATION-v6.62.md`.

## v6.61 automatic multichannel digital demand

- Email, live-chat and social contacts arrive automatically during active shifts, each on its own deterministic schedule.
- Every digital channel has a bounded waiting capacity; additional simulated demand is counted as overflow.
- The agent workspace shows per-channel automatic arrivals, total digital intake, overflow and the next expected arrival.
- The supervisor command centre now tracks digital arrival and overflow metrics alongside voice queue metrics.
- Standard, Busy period and Recovery demand profiles adjust future voice and digital arrival intervals. Pause/resume remains a voice-intake control; digital arrivals continue independently.
- Automatic arrivals use the organisation-configured illustrative digital response target and the same accelerated simulation clock as the shift.
- The first digital queue is seeded once per shift. Later demand comes from automatic arrivals or the explicit manual batch control.

All digital contacts remain fictional local simulation records. They are not received from or sent to live email, social or messaging services.

## v6.60 supervisor live operations

- A unified board summarises waiting inbound voice, email, live chat and social contacts, active work, open supervisor assistance requests and escalated/review cases.
- Voice contacts show simulated wait age and an illustrative 60-second service-risk threshold. Digital contacts show wait age against their configured illustrative channel target; the risk marker activates at 75% of that target.
- Supervisors can pause or resume new automatic inbound arrivals without closing the shift or clearing the queue. Existing waiting customers continue to age and can still abandon while intake is paused.
- Three demand profiles change the arrival interval: Standard (1.00x), Busy period (0.72x) and Recovery (1.42x). A faster/slower profile affects future automatic arrivals, not contacts already waiting.
- Supervisors can change priority and route group for waiting voice and digital contacts. Each saved triage action requires a reason and records its before/after values on the contact timeline.
- Intake control changes and triage actions are written to the supervisor audit panel and the existing operations timeline.
- Legacy saves are normalised safely. A new workday starts with Standard/Open intake while prior audit history is retained.
- The command-centre layout adapts to phone and desktop widths.

All queue activity and control effects are local fictional simulation events. Pause/mode changes do not control a real dialler, telephone network, email provider, social inbox, external team or production SLA. This release does not add a database migration, secret, environment variable or external provider dependency. It does not claim v0.2 Advanced Contact Centre Operations is complete.


## v6.59 live queue operations

- The first shift queue is seeded and timestamped against the accelerated in-game clock.
- New synthetic inbound voice contacts arrive automatically during the active 08:00–17:00 shift. Arrival intervals vary by time of day and use a deterministic seed so the same saved shift produces repeatable demand.
- The waiting queue is capped at 24 contacts. Demand beyond capacity is recorded as overflow instead of growing without limit.
- Customers receive priority-based patience windows. A contact still waiting after its patience expires becomes an abandoned contact and leaves the waiting queue.
- The agent and supervisor queue screens show automatic arrivals, next-arrival estimates, abandonments and overflow events.
- Manual six-contact demand surges remain available as an explicit control; they are recorded separately from automatic arrivals.
- The new queue events are written into the existing operations timeline and use the existing contact lifecycle and priority routing.
- Closing a shift stops new arrivals. Advancing to a new workday clears the prior day's queue and starts a fresh queue schedule.

All customers, arrivals, wait times, abandonments and demand-overflow events are fictional simulation data. This feature does not connect to a real telephone network, dialler provider or customer database. It does not claim that v0.2 Advanced Contact Centre Operations is complete.

The v6.59 demand simulation remains the engine used by the v6.60 supervisor intake controls.

## v6.58 Try-It Studio — previous release preserved

## Visitor experience

The Customer Care discovery guide now includes a **Try before you choose** strip and a **Try a quick preview** action on each recommended product card. Visitors can explore all six previews or start with a goal they selected:

- RuffNeck Learn: define a learning outcome and check practical learning.
- RuffNeck Prospector: qualify a fictional business lead and record an agreed next step.
- RuffNeck Connect: welcome a new member and resolve a collaboration disagreement.
- RuffNeck Social Hub: choose a campaign objective and meaningful result measure.
- Kano Run / Kano Life: make safe decisions in fictional driving situations.
- Kano Keke: handle a passenger route and vehicle-capacity situation responsibly.

Each preview has two short decisions, explanations for the choices, a score, and links to the official destination or a prefilled access/pricing enquiry.

## Guest-first and privacy boundary

- No CALLORIA account, contact details, payment details, or live RuffNeck login is required for a preview.
- Completion counts and best scores are stored locally in the visitor's browser under `calloria.public.tryit.v1`.
- Preview results are not submitted to CALLORIA or a RuffNeck product.
- Each exercise is clearly labelled as a fictional educational sample, not a live product demonstration or a statement of actual product functionality.
- The access/pricing link opens the existing support router with a product and enquiry intent preselected. The visitor reviews the request and remains responsible for consent and submission.
- Official product navigation opens the relevant existing RuffNeck destination in a new tab.

The v6.58 visitor-preview behaviour, v6.59 live voice queue and v6.60 supervisor command centre remain preserved. v6.61 extends digital demand; it does not replace recruitment, customer dialogue, wrap-up, CRM, QA or career modules. The full regression/build status is in `VERIFICATION-v6.61.md`; installation steps are in `INSTALL-GITHUB-v6.61.md`.

## Package contents

- `js/voice-customer-behaviour-engine.js`: v6.65 live simulated voice-customer dialogue, adaptive response scoring, security detection, interruption/negotiation behaviour, active-call supervisor risk flags and saved-state migration.
- `tests/voice-customer-behaviour-v665.test.mjs` and `tests/voice-customer-behaviour-ui-v665.test.mjs`: focused behaviour and application-wiring regression tests.
- `js/digital-sla-engine.js`: v6.63 first-response deadline, risk/breach/met transitions, response-outcome metrics and compact labels.
- `js/agent-workload-engine.js`: v6.62 multi-contact worklist, capacity policy and assignment/resumption guards.
- `js/main.js`: cumulative recruitment/operations application, v6.62 assigned-work tabs and multi-contact workload integration, plus v6.63 accelerated-clock SLA monitoring, event capture and agent/supervisor indicators, and v6.65 live adaptive voice-customer dialogue.
- `js/supervisor-queue-engine.js`: supervisor counts for concurrent active digital work and customer-waiting assignments, plus first-response risk and breach status.
- `styles.css`: responsive work tabs, queue controls, workload/capacity indicators and digital SLA states.
- `tests/digital-sla-engine-v663.test.mjs`, `tests/digital-sla-ui-v663.test.mjs` and `tests/supervisor-sla-integration-v663.test.mjs`: 30 v6.63 engine and integration tests.
- `tests/agent-workload-engine-v662.test.mjs` and `tests/agent-workload-ui-v662.test.mjs`: 32 v6.62 engine and integration tests.
- `docs/CALLORIA-v6.63-DIGITAL-FIRST-RESPONSE-SLA.md`, `INSTALL-GITHUB-v6.63.md`, `TEST-RESULTS-v6.63.txt` and `VERIFICATION-v6.63.md`: release and acceptance documentation.
- `docs/CALLORIA-v6.62-UNIFIED-AGENT-WORKLOAD.md`, `INSTALL-GITHUB-v6.62.md`, `TEST-RESULTS-v6.62.txt` and `VERIFICATION-v6.62.md`: v6.62 release documentation.
- v6.61 digital arrival engine and tests, v6.60 supervisor controls and tests, v6.59 inbound voice queue and tests, v6.58 Try-It Studio, and the existing recruitment, employment, 3D workplace runtime, operations, CRM, multichannel, voice, QA, career, organisation, Supabase and Vite configuration are retained from the supplied cumulative source snapshot.

This is a cumulative replacement for the preserved v6.64 repository snapshot. The source archive did not include `public/assets/` or its GLB binaries; keep those files from the actual GitHub checkout when merging. Keep the hidden `.git` directory and local environment files. No credentials, provider secrets or database exports are included.

## Commercial readiness boundary

CALLORIA is a contact-centre career and operations simulator, but this source snapshot is not a finished commercial product. It still needs production service integrations where approved, end-to-end browser acceptance, representative physical-device QA, full asset verification, security/privacy review and organisation-approved operating targets. The recruitment assessment is an employment entry gate; it is not the main gameplay.
