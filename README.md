# CALLORIA v4.5.0 — Outbound Campaign Operations

## Purpose

This release advances the post-onboarding working experience from pre-written outbound answer choices to an interactive, multi-turn campaign conversation. It is a simulation of employee work inside a contact centre; it does not call real telephone numbers or connect to an external dialler.

## Player workflow

1. Complete recruitment, the full OJT path, trainer sign-off, workstation allocation and the required shift/briefing gate.
2. Open Outbound during an active shift while the agent status is Available.
3. Select an enabled synthetic campaign contact. Existing suppression rules and already-completed campaign attempts remain enforced.
4. The customer opens the conversation. The agent must identify themselves, state the specific reason for contact and ask whether it is a convenient time.
5. The customer reacts to a deterministic preference: open to a brief conversation, busy, callback requested, not interested, or do-not-contact.
6. The agent types responses in their own words. The dialogue checks transparency, permission, empathy, factual clarity and next-step handling.
7. A busy customer can be routed to an agreed callback; a decline is recorded without continuing the pitch; a do-not-contact request is added immediately to the suppression register.
8. Complete after-contact work. The existing wrap-up controls validate factual notes and disposition, schedule a future callback and save CRM/campaign records.
9. Due callbacks can be resumed only after their due time and while the employee is available during the working shift.

## What is included

- Conversational outbound campaign UI replacing the legacy multiple-choice outbound contact screen.
- Deterministic synthetic customer preference and persona responses.
- Identity, campaign-purpose and time-permission checks.
- Respectful decline, callback-request and do-not-contact outcomes.
- Immediate persistence of an opt-out into the existing suppression register, including if the agent ends the active interaction before wrap-up.
- Existing callback scheduling and due-callback resumption retained.
- Campaign attempt dashboard, attempt history, suppression register and callback workload summary.
- Supervisor assistance request and customer voice playback action.
- Transcript, preference, QA scorecard and compliance evidence saved to the existing CRM case and outbound attempt records.
- Product-offer sales credit is granted only when the synthetic customer explicitly accepts after receiving the terms; merely completing a product-offer conversation does not count as a sale.
- Unresolved conversations can be dispositioned as review required and create a supervisor follow-up record rather than being silently counted as completed.
- Responsive mobile interaction layout.

## Industry scope

The existing campaign catalogue is reused. This plugin does not convert CALLORIA into a bank-only simulator. General customer experience and the existing multi-industry packs remain the product foundation; banking is one optional industry.

## Safety and simulation boundaries

- All customers and campaigns remain fictional synthetic data.
- No real telephone call is placed; no real phone number, contact list or external dialler is accessed.
- The game does not claim that a synthetic campaign template has legal consent for real-world marketing. A real deployment would require organisation-approved purpose, lawful contact basis, time-window rules, frequency limits, jurisdictional controls and verified suppression data.
- The engine flags solicitation of PINs/passwords/OTPs, unverified campaign claims and coercive pressure.
- Customer opt-out is added to the suppression register immediately, not only when an agent eventually saves wrap-up.
- Outbound interactions remain separate from recruitment and OJT assessment records.

## Files

- `vite.config.js` — complete merged Vite configuration based on the v4.4 package; registers v4.5 after the existing v4.4 post-transform.
- `build/calloria-outbound-campaign-v4-5-plugin.mjs` — fail-safe Vite transform for the outbound workbench and CRM evidence bridge.
- `js/outbound-campaign-engine.js` — deterministic outbound conversation and compliance engine.
- `tests/outbound-campaign-engine-v45.test.mjs` — engine regression tests.
- `tests/calloria-v45-outbound-plugin.test.mjs` — integration, anchor, idempotency and transformed-source syntax tests.
- `INSTALL-GITHUB.md`, `CHANGELOG.md`, `VERIFICATION.md`.

## Compatibility basis and limitation

This overlay targets the exact source shape documented by the v4.4 package, which was prepared against repository commit `74e0582`. It expects the v4.4 inbound conversation plugin and its import to be present. It checks all required anchors before transforming and skips safely with a warning if they do not match. It is not a full project ZIP and must not be installed as a replacement for the repository.
