# CALLORIA v6.59 — Live Queue Operations

A cumulative upgrade built on the supplied CALLORIA repository snapshot. v6.59 turns the inbound workload into a moving shift simulation: contacts arrive automatically, waiting customers have priority-based patience, queue capacity is enforced, and supervisors can see arrivals, abandonments and demand overflow.

The recruitment and assessment pathway remains the entry gate. The main gameplay remains employed agent work: handling customer contacts, using the CRM and service tools, completing after-contact work, receiving QA and progressing through a contact-centre career.

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

The v6.58 visitor-preview behaviour remains unchanged by v6.59. The v6.59 runtime change is limited to inbound queue operations and its shift telemetry; it does not replace recruitment, customer dialogue, wrap-up, CRM, QA, supervisor or career modules.

## Package contents

- `js/live-queue-engine.js`: new v6.59 deterministic live inbound queue engine.
- `js/main.js`: integrated shift clock, automatic arrivals, queue abandonment, queue telemetry and demand surge handling.
- `tests/live-queue-engine-v659.test.mjs` and `tests/calloria-live-queue-v659.test.mjs`: engine and application integration regression tests.
- Existing `build/`, v6.58 Try-It Studio plugin, test fixtures, pages, modules, configuration and Supabase source are retained from the supplied repository snapshot.
- `docs/CALLORIA-v6.59-LIVE-QUEUE-OPERATIONS.md`, `VERIFICATION-v6.59.md`, and `TEST-RESULTS-v6.59.txt` document the feature and its verification boundary.

The archive is a cumulative source replacement for the repository snapshot supplied for this upgrade. That upload did not contain `public/assets/` or its GLB binaries. The ZIP therefore cannot restore those missing files. Preserve any existing `public/assets/` folder in the local/GitHub repository when copying this upgrade into place. Environment files, secrets and Supabase credentials are not included.
