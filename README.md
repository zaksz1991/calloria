# CALLORIA v6.60 — Supervisor Live Operations Command Centre

A cumulative upgrade built from the supplied `calloria.zip` repository snapshot and the saved v6.59 cumulative release. v6.60 turns the Supervisor view into an actionable command centre for the same simulated workload the agent handles: supervisors can pause or resume new arrivals, adjust demand pace, inspect voice and digital service risk, change waiting-contact priority and route group, and review an auditable history of decisions.

The recruitment and assessment pathway remains the employment entry gate. The main gameplay remains employed agent work: queue handling, customer conversations, CRM and case records, service tools, after-contact work, QA, supervisor assistance and career progression. This is not a training-only conversion.

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

The v6.58 visitor-preview behaviour and v6.59 live inbound queue engine remain preserved. v6.60 extends the existing supervisor screen and queue state; it does not replace recruitment, customer dialogue, wrap-up, CRM, QA or career modules.

## Package contents

- `js/supervisor-queue-engine.js`: v6.60 intake controls, voice/digital triage, unified queue metrics and supervisor audit state.
- `js/live-queue-engine.js`: v6.59 arrival engine with pause-aware intake and bounded demand-profile intervals; customer patience still runs during intake pause.
- `js/main.js`: supervisor command-centre screen, persisted controls, triage submissions, operation timeline and safe migration.
- `styles.css`: responsive supervisor queue-control and triage layouts.
- `tests/supervisor-queue-engine-v660.test.mjs` and `tests/supervisor-queue-ui-v660.test.mjs`: v6.60 engine and application integration regression tests.
- v6.59 live queue tests, v6.58 Try-It Studio files/tests, existing game, office, GLB runtime, recruitment, operations, CRM, digital channels, voice, QA, career, organisation, Supabase and Vite configuration are retained from the supplied source snapshot.
- `docs/CALLORIA-v6.60-SUPERVISOR-QUEUE-COMMAND-CENTRE.md`, `VERIFICATION-v6.60.md`, and `TEST-RESULTS-v6.60.txt` describe the release and verification boundary.

The archive is a complete cumulative replacement for the repository snapshot supplied for this upgrade, including the v6.59 changes from the immediately preceding release. The upload did not contain `public/assets/` or its GLB binaries. The ZIP therefore cannot restore those missing files. Preserve the existing `public/assets/` folder in the actual GitHub checkout when copying this upgrade into place. Other files under `public/` that were present in the upload are retained. Environment files, private secrets and Supabase credentials are not included.
