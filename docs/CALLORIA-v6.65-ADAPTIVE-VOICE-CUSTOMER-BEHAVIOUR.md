# CALLORIA v6.65 — Adaptive Live Inbound Voice Customer Behaviour

## Player-facing behaviour

An accepted simulated inbound call receives a deterministic customer persona and opening statement. The persona is based on the contact and scenario and remains stable for the interaction. Supported profiles include cooperative, frustrated, anxious, confused, time-pressured and repeat complainant.

Guided call-handling choices and free-form typed responses use the same conversation engine. Optional browser speech-to-text can populate the response field; the agent still submits the recognised words for evaluation. The latest customer response, agent statements and customer follow-ups appear in the live call transcript. The customer can also be heard through the existing browser text-to-speech control.

The engine evaluates acknowledgement, ownership, secure handling, plain language and a clear next step. It updates synthetic customer sentiment, patience and emotion, and applies a bounded behavioural score to the active call. The conversation is limited to eight agent turns so that a contact cannot be held open indefinitely.

## Interruptions and service recovery

A dismissive response or a combination of low sentiment/patience and missing acknowledgement can trigger a customer interruption. The call pauses for an explicit decision: listen, take ownership, defend the response, or offer supervisor support.

For eligible dispute/payment/complaint scenarios, a conditional discussion of a refund, reversal, compensation or similar remedy can trigger a service-recovery decision. The agent must explain options or check authority; unsupported promises and dismissive closures are flagged. The customer decision panel must be resolved before the agent continues or moves to wrap-up.

## Security and privacy

The engine detects simulated agent requests for PINs, passwords, one-time codes, CVV/CVC, security codes or full card numbers. It flags critical quality/security risk, generates a customer objection, reduces the simulated customer confidence, and recommends a supervisor/security review. Credential values and payment-card numbers are redacted from stored transcript messages. Do not enter real customer, account or financial information into the simulator.

The optional microphone path remains consent-gated. Audio capture is a local browser sample. Speech recognition depends on browser support and may be processed by the browser's speech service. CALLORIA does not stream calls to a PBX, connect to a real telephone network or upload the local recording to a telephony provider.

## Supervisor and CRM integration

When the active voice conversation crosses the intervention thresholds or produces a critical quality flag, CALLORIA creates a supervisor assistance request. The Supervisor Operations page displays active-call customer risk, interruption count and detected security-breach count. These voice counters describe the current active player call, not a multi-agent enterprise-wide live voice feed.

After-contact work uses the voice behaviour engine's final outcome to default to escalation where risk remains. Risk requiring escalation cannot be marked resolved in the wrap-up form. The simulated CRM case retains customer sentiment, emotion, persona, interruption count, negotiation status, voice QA estimate, quality flags, supervisor reason, outcome and sanitised transcript.

## Acceptance checks

1. Accept a synthetic inbound contact and confirm a persona and opening customer statement appear.
2. Send a guided response and confirm the engine adds both the agent response and a context-sensitive customer reaction to the transcript.
3. Submit a typed response and confirm the same behaviour engine updates sentiment, patience and call score.
4. With explicit microphone consent and supported browser APIs, record a local sample and use speech-to-text; submit the recognised response and confirm it uses the same engine.
5. Trigger an interruption with dismissive handling; confirm the call pauses and the decision panel offers recovery choices.
6. Resolve a service-recovery decision using the approved-options/authority path; confirm the transcript records the decision and customer reaction.
7. Trigger a prohibited secret request and confirm redaction, a critical flag, a customer objection and a supervisor request.
8. Reach the eight-turn limit and confirm further response controls are disabled while wrap-up remains available.
9. Complete wrap-up and confirm sentiment, emotion, persona, interruptions, negotiation state, voice QA, quality flags and sanitised transcript appear in the saved simulated case.
10. Reload the local save and confirm an active call's voice state is normalised and retained.

## Delivery boundaries

All personas, conversations, sentiment values, patience values, call quality changes and outcomes are fictional simulation rules; they are not real customer analytics or validated psychological measurements. This release adds no external telephony/PBX, real dialler, speech-provider integration, database migration, secret, environment variable or new package dependency. Browser speech services remain subject to their own browser/vendor handling. Unit tests and syntax validation do not replace production build, browser, mobile-device or deployment acceptance.
