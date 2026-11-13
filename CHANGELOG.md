# CALLORIA v6.43 — Live inbound customer dialogue

## Player-facing change

Active inbound calls now include a live text conversation panel alongside the existing operational decision points. The agent can write a response and receive a scripted customer reply based on communication markers. The panel displays the customer's current tone and keeps the most recent exchanges visible.

## Voice connection

When the existing microphone/transcription panel has captured text, the player can send that transcript directly into the same customer conversation. Audio remains in the existing page-memory flow; the dialogue bridge stores text only.

## Quality and compliance

- Evaluates empathy, ownership, approved verification, investigation and clear next-step language.
- Adds a small quality adjustment to the active call score.
- Detects direct requests for PINs, passwords, OTPs, security codes and full card numbers.
- Flags a detected secret request as a compliance incident once per call and moves the call into the existing escalation-required path.
- Redacts explicit credential values and long numeric sequences before retaining the agent statement.
- Stores both sides of the dialogue in the active contact timeline and the completed CRM case's `dialogue` transcript field.

## Simulation boundary

Customer replies are deterministic scripted responses, not AI-generated. There is no real telephony, external customer messaging or external transcript request. The existing scenario decision flow remains in place as the operational assessment layer.

## Integration

The overlay includes the v6.42 voice-to-CRM plugin because the current public `main` branch Vite configuration does not register it. The supplied Vite configuration registers v6.42 first and v6.43 second.
