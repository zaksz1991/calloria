# CALLORIA v6.61 — Automatic Multichannel Digital Demand

## Purpose

Add automatically generated, in-shift digital workload to the existing CALLORIA agent operations simulation. Email, live chat and social contacts arrive on independent schedules and share the existing accelerated shift clock used by inbound voice. This is local synthetic gameplay data; it is not a live inbox or provider integration.

## Runtime behaviour

- Email, live chat and social each have a first-arrival offset, recurring interval and bounded jitter.
- The schedules are deterministic from the saved simulation seed, so a saved shift can continue predictably after reload.
- At most one arrival per channel is processed in an update. A suspended browser tab does not replay every missed arrival as a sudden catch-up burst.
- The default waiting capacities are 18 email contacts, 14 live-chat contacts and 16 social contacts. Only contacts still in `queued` status consume waiting capacity. Active or completed work does not.
- When a channel is full, the engine records an overflow event and counter instead of adding another waiting contact.
- If a channel has no available scenario catalogue entries, it schedules a bounded retry rather than stalling permanently.
- Automatic contacts use the active organisation's configured digital response target when available. The value is a game simulation target, not a contracted SLA.
- The opening digital batch is seeded only once per shift. After it is seeded, the queue is replenished by the automatic arrival engine or the existing explicit manual batch action.
- Shift closure disables automatic digital intake. A new workday receives a fresh schedule and counters.

## Supervisor and agent visibility

The agent's Digital workspace reports automatic arrivals and overflows by channel, total digital intake, and the next scheduled arrival. The supervisor board includes the digital demand snapshot alongside the existing voice queue, service-risk, assistance and escalation information. Existing demand profiles adjust future arrival intervals for both voice and digital queues. The existing voice pause/resume action remains separate: it does not silently pause digital intake.

Automatic arrivals and overflow events are written to the digital activity log and the primary operations timeline. Digital wait age, first-response and supervisor service-risk calculations use the same simulated shift clock as automatic arrivals.

## Verification and constraints

See `VERIFICATION-v6.61.md` and `TEST-RESULTS-v6.61.txt` for exact checks and limitations.

No database migration, external service, provider secret, environment variable or package dependency is introduced. All generated customer details, contact contents, timestamps, queues and outcomes are synthetic. No email, social post, chat message or telephone call is transmitted.

This increment does not by itself complete v0.2 Advanced Contact Centre Operations. It does not provide live provider connectivity, speech recognition, real customer data, real workforce routing, real-time multi-user collaboration or multi-organisation administration.
