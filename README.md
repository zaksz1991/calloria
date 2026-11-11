# CALLORIA v4.4.0 — First Independent Shift Gameplay

This is the first post-onboarding operations upgrade. It moves inbound voice from a sequence of pre-written answer choices to actual simulated agent work.

## Player experience

1. The employee must already be hired, complete product/service knowledge, CRM logging, experienced-agent shadowing and supervised practice, receive trainer sign-off, receive a workstation and satisfy the established shift/briefing gate.
2. During an active shift, the employee opens the inbound desk and accepts a waiting customer contact from the existing prioritised queue.
3. The customer speaks first. The player types a response in their own words.
4. Customer replies branch according to a deterministic persona, the agent's response behaviours and remaining customer patience.
5. The player can use the linked customer record, knowledge base, hold/resume, supervisor assistance, specialist transfer and queue-return controls.
6. When the conversation reaches wrap-up or mandatory review, the existing after-contact workflow requires factual notes and a permitted disposition.
7. The resulting CRM case stores the transcript and response scorecards; the existing queue, QA, CSAT, case and career metrics continue through the existing save path.

## Included files

- `vite.config.js` — complete replacement based on the repository Vite configuration at commit `74e0582`; adds the v4.4 plugin after the existing OJT/GLB integration.
- `build/calloria-first-working-shift-v4-4-plugin.mjs` — Vite transform for the live inbound screen, response form, transcript persistence and QA bridge.
- `js/operational-conversation-engine.js` — deterministic multi-turn customer dialogue and rule-based customer-care/compliance evaluation.
- `tests/operational-conversation-engine-v44.test.mjs` — conversation-engine regression tests.
- `tests/calloria-v44-first-working-shift-plugin.test.mjs` — integration transform and syntax tests.

## Important limits

- This package does not contain or replace the complete CALLORIA application.
- The patch expects the upstream `js/main.js` and existing modules to remain compatible with the exact anchors tested against the `74e0582` source baseline.
- This is a synthetic call simulation. No real telephone call is placed, no external customer data is accessed, and no LLM provider is called.
- Existing OJT and GLB files are not included as replacements. Keep the already-installed v4.3 onboarding runtime and v3.8.2 GLB plugin in place.
- The package does not add the next digital/outbound gameplay channel or complete the GLB rendering issue.
