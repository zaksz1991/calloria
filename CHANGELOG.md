# CALLORIA v4.4.0 — First Independent Shift Gameplay

## What changes

- Replaces the inbound call's legacy multiple-choice response panel with a live, multi-turn agent/customer conversation workspace.
- Creates a conversation when the agent accepts an actual queued inbound contact during an active shift.
- Uses deterministic customer personas with changing patience and conditional replies.
- Lets the player type natural-language responses instead of choosing pre-written answers.
- Evaluates greeting, empathy, ownership, probing, clarity and next-step explanation.
- Flags credential solicitation, payment-card data solicitation, unverified promises and dismissive treatment as critical review events.
- Shows the linked customer/CRM context, case reference, queue route, wait and interaction branch during the call.
- Preserves hold, resume, supervisor request, transfer, queue return and existing after-contact-work controls.
- Persists the transcript and turn scorecards into the CRM case record.
- Uses the conversation's QA result for the inbound wrap-up score; keeps unresolved customer outcomes open/escalated rather than falsely marking them resolved.
- Adds responsive transcript and reply controls for mobile screens.

## Product boundaries

- Recruitment and the four OJT modules remain the entry gate. This engine is for post-training, independent shift work only.
- The existing inbound queue and industry scenario catalogue are reused. The conversation engine is industry-neutral and does not default all contacts to banking.
- Customer conversations are synthetic and deterministic/rule-based. This is not an LLM or a live contact-centre telephony connection.
- The existing browser speech playback action is retained; microphone capture and speech recognition are not introduced by this release.
- No external customer records, phone calls, messaging providers or production CRM systems are accessed.

## Build integration

The new Vite plugin runs after the existing OJT/GLB plugin. It uses exact, single-occurrence anchors and skips the live-shift transform with a warning if the upstream source has materially changed; it does not apply a partial transform.
