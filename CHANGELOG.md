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
