# CALLORIA v6.60 — Supervisor Live Operations Command Centre

## Purpose

Extend the v6.59 moving inbound queue into a supervisor operations screen with controls that affect the same simulated workload the agent is handling. This is an in-game management surface, not a real contact-centre control plane.

## Delivered behaviour

- Unified supervisor snapshot for waiting voice, email, live chat and social contacts.
- Voice queue SLA risk is flagged at the illustrative 60-second simulated wait threshold.
- Digital queue risk is flagged after 75% of the contact's configured illustrative channel target has elapsed.
- Supervisor can pause or resume new automatic inbound arrivals while keeping the shift active.
- A pause does not suspend customer patience. Existing queued customers continue to age and can abandon normally.
- Three deterministic demand profiles are available: Standard (1.00x interval), Busy period (0.72x interval), and Recovery (1.42x interval).
- Supervisor can change priority and route group for a waiting voice or digital contact.
- Triage is rejected for missing, active, completed or otherwise non-waiting contacts.
- Each queue-control and triage action requires a reason and is added to the supervisor audit trail and existing operations timeline.
- Legacy local saves receive safe defaults. Starting a new workday resets intake to Standard/Open while retaining the prior supervisor control history.
- The view is responsive and retains the existing agent, CRM, channel, QA and career flows.

## Operational interpretation

- **Pause intake** stops only new automatic synthetic inbound voice arrivals. It does not close the shift, clear the queue, disable already queued contacts, or pause customer patience.
- **Busy period** shortens the next scheduled and subsequent automatic arrival intervals. **Recovery** lengthens them. Neither mode changes contact records already in the queue.
- Reprioritisation changes the priority used by the existing queue ordering. Rerouting changes the displayed destination and the contact's audited route metadata; it does not create a separate department workforce or transfer to a real external team.
- Digital channel triage updates the existing local simulated email/live-chat/social queues. It does not connect to Resend, Termii, Meta or any live customer inbox.
- Voice and digital wait calculations use their respective timestamps: accelerated shift time for inbound voice, and received timestamps for digital contacts.

## Files

- `js/supervisor-queue-engine.js` — state normalisation, intake modes, reasoned pause/resume, voice/digital triage and unified supervisor queue metrics.
- `js/live-queue-engine.js` — paused-intake support and bounded arrival interval multiplier while preserving abandonment processing.
- `js/main.js` — persisted supervisor state, responsive control view, intake actions, voice/digital triage forms and audit timeline integration.
- `styles.css` — desktop and mobile command-centre layouts.
- `tests/supervisor-queue-engine-v660.test.mjs` — engine and behaviour tests.
- `tests/supervisor-queue-ui-v660.test.mjs` — application wiring, migration and responsive layout contracts.

## Limits

This remains a local synthetic simulator. It does not control a real dialler, telephone network, email provider, social inbox, real agent workforce or production SLA. Actual organisation routing rules and contractual service targets must be configured and approved by the relevant organisation. The change does not add database migrations, provider secrets or external service dependencies.
