# CALLORIA v3.6.0 — Live Inbound Customer Operations

This release advances the main game from a multiple-choice inbound call flow to an operational, multi-turn customer conversation during an active employee shift.

## What changes

- The inbound contact screen becomes a customer/agent conversation transcript with a free-text agent response composer.
- Synthetic customer personas vary patience and response behaviour.
- Customer replies branch according to the agent's acknowledgement, ownership, information gathering and explanation of a safe next step.
- A transparent deterministic interaction score evaluates service behaviours and critical compliance failures. It does not call an external AI provider.
- PIN/password/OTP solicitation, full card-data solicitation, unsupported guarantees and dismissive treatment trigger mandatory escalation.
- Customer voice playback uses the browser's speech synthesis when available.
- Existing hold, resume, supervisor request, specialist transfer, queue return, after-contact work and case disposition controls remain available.
- The conversation transcript and turn scorecards are saved into the inbound CRM case record.
- Specialist follow-up becomes the default disposition when the interaction ends without a sufficient safe next step.

## Product boundary

Recruitment and aptitude/practical assessments remain the entry gate. This release changes the main employee gameplay after hiring; it does not convert recruitment into the main game.

The customer data is synthetic. The conversation engine is deterministic and is not a live LLM, real telephone connection, external CRM or bank core system. Customer voice playback uses local browser speech synthesis. Microphone-driven live dialogue is a later voice milestone.

## Files

- `vite.config.js` — complete replacement preserving the current production multi-page inputs and plugin order, with the v3.6 integration registered after v3.5.1.
- `build/calloria-live-inbound-conversation-v3-6-plugin.mjs` — source-checked Vite integration plugin.
- `js/operational-conversation-engine.js` — new deterministic operational dialogue and scoring engine.
- `tests/operational-conversation-engine.test.mjs` — engine tests.
- `tests/live-inbound-v36-integration.test.mjs` — source-contract and Vite transform tests. It expects the existing v3.5.1 plugin and current application files in the target repository.

## Installation

Follow `INSTALL-GITHUB.md`. Install over the current `main` branch that already contains `calloria-first-working-shift-v3-5-plugin.mjs` (v3.5.1). Do not combine with older v3.4 or v3.5 ZIPs.
