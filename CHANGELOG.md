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
