# CALLORIA v6.67 — Campaign Contact Worklists & Dialler Retry Governance

## Added

- Eight deterministic synthetic contacts per outbound campaign, with stable contact IDs and the existing campaign customer retained as the first entry.
- Contact-level attempt history with agent owner, attempt number, timestamp, outcome and retry/callback eligibility.
- Deterministic Answered, No answer, Busy and Voicemail dial outcomes connected to the v6.66 live conversational workflow.
- Separate retry delays of 15 minutes (no answer), 30 minutes (busy) and 120 minutes (voicemail), with a default maximum of three attempts and an exhausted state.
- Customer-requested callbacks tied to their campaign contact, protected by future-date and due-time checks.
- Completed, declined, opt-out/suppressed, review-required and attempt-limit states, with worklist metrics and responsive UI.
- Legacy local-save migration from existing campaign attempts and callbacks where a template match is available.
- 15 engine tests and 13 application integration tests; syntax check and package-manifest test updated.

## Verification

- `npm run check`: passed.
- Focused v6.67 and v6.66 outbound regression suite: 35 passed, 0 failed.
- Full repository suite: 1,981 tests; 1,437 passed; 544 failed. Compared with v6.66 by failing test names: same 544 failing instances and 526 distinct failing names; zero new failing names.
- Vite production build: not verified (`vite: not found` because `node_modules` was not installed in the preparation environment).
- Browser walkthrough and Vercel deployment: not performed.

## Boundaries

- All campaign records and dial outcomes are synthetic gameplay; there is no external dialler, PBX, provider or real customer contact data.
- No Supabase migration, secret, environment variable, external provider or npm dependency is added.
- Recruitment remains an entry gate; the core gameplay is agent operations and career progression.
- Preserve the real repository's `public/assets/` GLB folder and `.git` directory; the source archive used for this release did not contain `public/assets/`.

---

# CALLORIA v6.66 — Live Conversational Outbound Operations

## Added

- Integrated the existing outbound conversation engine directly into the live main application module.
- Replaced multiple-choice outbound campaign progression with a customer transcript and free-form agent responses.
- Added simulated customer preference states: open, busy, callback, declined and opt-out.
- Added response evaluation for honest identity, purpose, permission, empathy, clarity, callback handling, respectful declines and campaign conduct.
- Added critical flags and supervisor review for credential solicitation, unsupported promises and coercive language.
- Added do-not-contact suppression enforcement, callback recording and explicit acceptance requirements before product-offer sales credit.
- Persisted outbound transcripts, scorecards, customer decisions and compliance flags to the simulated CRM case and outbound attempt history.
- Added synthetic customer speech playback and supervisor-assistance requests in the live outbound screen.
- Removed the stale v4.5 build-time outbound transformer; the application now imports the engine directly.
- Added seven UI/integration regression tests and extended the project syntax-check script.

## Verification

- `npm run check`: passed.
- Focused outbound engine and application integration tests: 17 passed.
- Full test suite: 1,953 tests; 1,409 passed; 544 failed. This matches the v6.65 baseline by failing test name: 526 distinct existing failure names, zero new failing names.
- Vite production build and Vercel deployment: not verified.

## Boundaries

- All outbound customers and campaigns remain synthetic. No real calls, provider connections, database migration, new secret, environment variable or dependency are added.
- Browser-generated speech is a playback aid, not a recording or telephony connection.
- Recruitment remains the employment entry gate. The product remains a contact-centre career and operations simulator.

---

# CALLORIA v6.65 — Adaptive Live Inbound Voice Customer Behaviour

## Added

- Added a single adaptive voice-customer engine shared by guided call choices and free-form typed/speech-to-text agent responses.
- Added deterministic customer personas, live agent/customer transcript entries, sentiment and patience changes, emotion display and an eight-agent-turn limit.
- Added customer interruption decisions that pause the call until the agent chooses a listening, ownership or supervisor response.
- Added conditional service-recovery decisions for eligible complaints/disputes, including authority checks and flags for unsupported promises. Unresolved negotiations remain escalation-required until the agent checks authority.
- Added detection and transcript redaction for simulated requests involving passwords, PINs, one-time codes and payment security details. Protective warnings are not misclassified; mixed replies that still solicit a credential remain flagged.
- Connected active-call intervention risk to the Supervisor Operations page and saved voice outcomes, QA estimate, quality flags and sanitised transcript to the simulated CRM case at wrap-up.
- Added responsive transcript/decision UI, focused behaviour and UI integration tests, and a JavaScript syntax check for the new engine. The legacy v3.6 Vite source transformer yields to the newer adaptive voice workflow.

## Boundaries

- All customers, dialogue, sentiment, patience, quality scoring and outcomes are fictional gameplay rules, not real customer data or validated psychological measures.
- Browser speech-to-text is optional and consent-gated; no PBX, real telephone network, live dialler or external speech provider is connected. A local audio sample is not a telephone call.
- The Supervisor page's voice behaviour counters describe the active player call, not a multi-agent enterprise-wide feed.
- No Supabase migration, new secret, environment variable or package dependency is added.
- Recruitment remains the entry gate; the primary gameplay remains agent operations, customer resolution, shift performance and career progression.
---

# CALLORIA v6.64 — Adaptive Digital Customer Behaviour

## Added

- Six deterministic digital-customer personas with persisted sentiment, patience and mood per contact.
- Adaptive customer replies based on the agent's acknowledgement, ownership, next step, privacy and persona-specific communication needs.
- Multi-turn customer conversations bounded to three simulated customer follow-ups per contact.
- Customer reaction history recorded in the interaction timeline and customer behaviour values retained in the CRM case record.
- Supervisor recommendations for critically low sentiment or repeated negative reactions, plus a live Customer Emotion Watch and agent-requested supervisor assistance.
- Responsive customer behaviour monitor in the agent digital workspace.

## Boundaries

- Customer behaviour, dialogue, sentiment and patience remain synthetic local game mechanics; they are not real customer analytics or validated psychological measures.
- Existing v6.63 first-response SLA, v6.62 agent concurrency, v6.61 digital demand, v6.60 supervisor operations and v6.59 voice queue releases remain preserved.
- No live provider, external AI, database migration, secret, environment variable or package dependency is added.
- Recruitment remains the entry gate; the main gameplay remains agent operations, customer resolution and career progression.

---

# CALLORIA v6.63 — Digital First-Response SLA Control

## Added

- A deterministic first-response SLA engine for simulated Email, Live chat and Social contacts, using each contact's saved response target and channel-default fallbacks where needed.
- A 75% first-response risk window, explicit due-soon/breached/met/late states, one-time contact timeline events and event-driven operations history.
- Agent work-tab, active-thread and waiting-queue SLA indicators; agent first-response outcome metrics; supervisor queue risk and breach visibility.
- Accelerated shift-clock integration so response timers advance at the same pace as the existing simulated shift and automatic digital arrival system.
- Focused engine, UI and supervisor regression tests, plus release verification and GUI installation documentation.

## Boundaries

- All contacts and response targets remain synthetic local game data. The targets are defaults for simulation, not contractual or regulatory SLAs.
- No live provider connection, notification, database migration, secret, environment variable or package dependency is added.
- v6.62 concurrent digital workload and earlier cumulative releases remain preserved. Recruitment continues to be the entry gate; the main gameplay remains agent operations and career progression.

---

# CALLORIA v6.62 — Unified Agent Workload & Digital Concurrency

## Added

- Bounded multi-contact digital work: up to three simultaneous active responses per agent, with channel caps of two email threads, two live chats and one social conversation.
- An assigned-work tab strip so agents can move between open digital conversations without losing the selected thread.
- A persistent compact waiting queue inside the active thread workspace, allowing additional eligible work to be accepted while capacity remains.
- Customer-waiting threads stay assigned but release active response capacity; follow-up resumption checks capacity again.
- Capacity-aware acceptance, channel-level caps, shift-window checks and mutual exclusion with voice/outbound/after-contact work.
- Agent status recalculation when a digital thread becomes active, moves to customer-waiting, resumes or is completed.
- Safe migration from the earlier single selected digital-thread save format.
- Supervisor visibility into concurrent active digital responses and customer-waiting threads.
- Responsive work tabs, queue actions and capacity indicators.

## Verification boundary

- The v6.62 workload engine includes 24 focused unit tests and 8 main-application/supervisor integration tests.
- The combined v6.58–v6.62 selected regression run is recorded in `TEST-RESULTS-v6.62.txt`.
- No successful Vite production build, browser-playthrough or Vercel deployment is claimed unless recorded separately.

## Boundaries

- All email, live-chat and social contacts remain fictional local gameplay records; there is no connection to real provider inboxes or customers.
- The concurrency limits are simulator policy defaults, not real-world staffing or contractual service standards.
- No database migration, provider secret, environment variable or external package is added.
- Recruitment remains the employment entry gate. The main gameplay remains agent operations, customer resolution and career progression.

---

# CALLORIA v6.61 — Automatic Multichannel Digital Demand

## Added

- Automatic synthetic arrivals for email, live chat and social-media work during an active agent shift.
- Independent, deterministic arrival schedules for each digital channel, sharing the same accelerated shift clock used by inbound voice.
- Per-channel waiting-capacity limits. Demand beyond a channel's waiting limit is counted as overflow rather than creating an unbounded queue.
- Per-channel arrival and overflow counters, next-arrival estimates and a digital live-demand panel in the agent workspace.
- Digital automatic-arrival and overflow events recorded in the digital activity log and main operations timeline.
- Supervisor demand profiles now adjust the future arrival intervals for voice and digital queues. The existing pause/resume action remains limited to voice intake; digital arrivals continue independently.
- Existing organisation-configured digital response target is applied to automatic arrivals.
- One opening digital batch is seeded per shift. After that, queues are replenished by automatic demand or the explicit manual batch control; opening contacts are no longer silently re-seeded whenever the queue becomes empty.
- Digital wait-age, first-response and supervisor SLA-risk calculations now use the accelerated shift clock consistently with automatically generated digital work.
- Safe migration for older local saves and clean digital intake shutdown when a shift closes.
- Responsive live-demand summary for phone and desktop layouts.

## Verification

- New v6.61 digital engine and UI tests: **21 passed, 0 failed**; combined v6.58–v6.61 focused regression run: **87 passed, 0 failed**.
- `npm run check`: **passed**, including the new digital live queue engine.
- Full suite: **1,835 tests; 1,291 passed; 544 failed**. Compared with v6.60, no new failing test name was introduced; one previous asset/roadmap documentation test now passes. The remaining failures are legacy repository failures; see `VERIFICATION-v6.61.md`.
- `npm run build` was attempted but Vite is not installed in the supplied source workspace (`vite: not found`). No successful production build or Vercel deployment is claimed.

## Boundaries

- Automatic email, chat and social contacts are fictional local game events. No live email provider, social account, customer inbox, telephone provider or customer system is connected.
- Channel intervals, capacity limits and response targets are illustrative game-balancing values, not approved contractual SLAs.
- Voice pause remains separate from digital intake; demand profiles affect future voice and digital intervals.
- No database migration, provider secret, environment variable or external package dependency is added.
- v6.60 supervisor operations, v6.59 voice live queue, v6.58 Try-It Studio and the recruitment-to-employment/career gameplay foundation remain preserved.


# CALLORIA v6.60 — Supervisor Live Operations Command Centre

## Added

- Unified supervisor live board for waiting inbound voice and digital contacts, current work, service-risk counts, open assistance requests and escalated cases.
- Reason-required pause/resume controls for new simulated inbound arrivals. Existing queue patience and abandonment continue while intake is paused.
- Standard, Busy period and Recovery demand profiles, with bounded deterministic arrival interval multipliers.
- Voice and digital contact triage: update a waiting contact's priority and route group, with status validation and required rationale.
- Per-contact triage metadata and timeline events containing actor, reason and before/after changes.
- Persistent supervisor control history and a local supervisor audit panel.
- Safe migration for older saved profiles; new shifts reset intake to Standard/Open while retaining prior control history.
- Responsive phone and desktop command-centre styling.
- Dedicated engine and application integration tests.

## Verification boundary

- Focused release regression: **66 passed, 0 failed**.
- `npm run check`: passed.
- Full suite: 1,814 tests; 1,269 passed; 545 existing failure instances across 527 distinct failing test names. The set of failing names is identical to the v6.59 baseline; no new full-suite failure was introduced.
- Vite production build was not verified because Vite dependencies were not installed in the uploaded source snapshot (`vite: not found`).
- No browser walkthrough, Vercel deployment or external-provider integration is claimed.

## Boundaries

- All queue records and controls remain fictional local gameplay simulation.
- Intake pause stops only automatic new voice arrivals; it does not close the shift, remove existing queue work or suspend customer patience.
- Demand profiles affect future synthetic voice arrivals only.
- Triage changes local priority and route metadata; it does not transfer a contact to a real external workforce.
- No database migration, external provider, secret, environment variable or new package dependency is added.
- v6.59 live queue operations and v6.58 Try-It Studio remain preserved. Recruitment remains an entry gate; actual agent operations and career progression remain the core product.

---

# CALLORIA v6.59 — Live Queue Operations

## Added

- Deterministic automatic inbound arrivals during the active simulated shift, with different arrival intensity by shift period.
- Priority-based customer patience and explicit `abandoned` contact lifecycle transitions.
- A hard cap of 24 waiting contacts and demand-overflow accounting.
- Accelerated-clock timestamps shared by queue creation, queue wait metrics, routing and customer abandonment.
- Agent and supervisor telemetry for arrivals, next expected arrival, abandoned customers and overflow events.
- Explicit six-contact demand-surge control, preserved alongside automatic arrivals.
- Shift-end queue shutdown and clean queue reset on the next workday.
- Dedicated deterministic engine tests and main-application integration regression tests.

## Boundaries

- This is a fictional, local contact-centre simulation. It does not place real calls or connect to a dialler, telephony provider or real customer system.
- Recruitment remains the employment entry gate; the main gameplay remains agent operations and career progression.
- Existing v6.58 Try-It Studio files, Vite registration, visitor experience and tests are preserved.
- No database migration, environment variable, secret, package dependency or external provider configuration is added.

---

# CALLORIA v6.58 — RuffNeck Try-It Studio

## Added

- Six short, interactive, fictional product previews for RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run / Kano Life, and Kano Keke.
- Two scenario decisions per preview with immediate explanations and a completion score.
- A guest-first progress strip and an all-previews shortcut.
- Browser-local completion progress; no preview response is sent to a server.
- Product-specific calls to action to open the official destination or prepare an access/pricing enquiry in the existing support router.
- Mobile-friendly modal layout, keyboard focus handling, Escape/backdrop close, and reduced-motion-aware styling.

## Boundaries

- Previews use fictional scenarios and do not claim to connect to live RuffNeck product accounts or services.
- No payment, account registration, lead submission, or support request is automatically performed.
- Existing game, workforce, CRM, Supabase configuration, secrets, package dependencies, and GLB assets are unchanged.
