# CALLORIA v6.66 — Live Conversational Outbound Operations

## Purpose

Make outbound campaign handling a playable agent operation instead of a multiple-choice training sequence. The agent starts a synthetic campaign contact, reads the customer's opening statement, responds in their own words, handles the customer's reaction and records the outcome in after-contact work.

## Agent workflow

1. Start a simulated shift and open the Outbound Campaign Dialler.
2. Start an eligible campaign contact. Suppressed contacts cannot be dialled.
3. Read the customer's opening statement and the campaign purpose/context.
4. Enter a free-form response. The simulation evaluates transparent identity, campaign purpose, permission to continue, empathy, clarity, respectful decline and callback handling.
5. Review the customer's next response and continue the dialogue until the engine returns a final state.
6. Use Play customer voice for browser-generated speech playback or Request supervisor for an assistance ticket.
7. Complete after-contact work with factual notes and a permitted final disposition.
8. The CRM case and outbound attempt history retain the transcript, scorecards, customer preference, customer decision, callback, suppression and critical compliance flags.

## Simulated customer states

The conversation engine deterministically assigns one of five preferences to each campaign attempt: open to a brief conversation, busy/time-limited, requested callback, not interested, or do not contact. A scheduled callback resumes with callback context. A do-not-contact state is entered into the suppression register immediately and prevents another campaign attempt.

## Controls and scoring

The agent must identify themselves and the organisation, state the actual campaign purpose and ask permission to continue. The engine evaluates empathy, clear explanations, next steps and respectful handling of refusal. Asking for PINs, passwords, one-time codes or payment security details, making unverified promises, or pressuring the customer creates a critical flag and a supervisor/compliance-review disposition. A product-offer sale is credited only when the synthetic customer explicitly accepts.

## Data and integration

The feature imports `js/outbound-campaign-engine.js` directly into `js/main.js`. Each submitted response updates the active conversation, case timeline and operations events. Final transcripts and scorecards are saved in simulated CRM cases and `state.outboundAttempts`. The previous Vite v4.5 text transformer is no longer registered because its source anchors did not match the current v6.65 main module; its responsibilities are implemented directly in the application runtime.

## Boundaries

This is a local fictional campaign simulator. It does not place calls, use a PBX, connect to a real dialler, send messages or access a live customer database. Customer voice is generated with browser speech synthesis, not customer audio. No Supabase migration, new secret, environment variable, external provider or package dependency is required.

## Product distinction

Recruitment and aptitude assessment remain the employment entry gate. The main gameplay is agent work: live simulated customer handling, CRM updates, case disposition, supervisor assistance, QA and career progression. The outbound conversation is an operational workstream, not a training-only quiz.
