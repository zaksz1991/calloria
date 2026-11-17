# CALLORIA v6.59 — Live Queue Operations

## Purpose

The inbound queue now behaves as a continuing workload during an active agent shift rather than relying only on a static opening batch or a manual refresh button. This is an operations-simulation upgrade: customers arrive, wait, may abandon, and contribute to measurable queue pressure while the employee is working.

## Shift behaviour

- The queue opens with the existing six seeded contacts (or the number retained by the saved shift).
- The live queue engine schedules further synthetic contacts from the 08:00 shift start through the nine-hour simulated shift.
- The game clock advances at the existing accelerated rate of 30 simulated seconds per real second. The queue uses a matching accelerated timestamp so wait ages, acceptance times and abandonment thresholds remain internally consistent.
- Arrival intervals vary by shift period and use a deterministic pseudo-random seed. A saved shift therefore retains a repeatable demand pattern.
- Waiting contacts are prioritised through the existing `operations-engine.js` priority and routing functions.
- Waiting capacity is capped at 24. Additional demand is not admitted and increments the overflow counter.
- Customer patience is simulated by priority: critical 24 minutes, high 21 minutes, normal 19 minutes and low 16 minutes. A contact that remains queued beyond its patience limit transitions to `abandoned`.
- Abandoned contacts are removed from the waiting count and written to the existing interaction timeline.
- The queue supervisor and agent inbound views display arrival, next-arrival, abandonment and overflow statistics.
- The manual six-contact demand surge remains available and is counted separately as an explicit user-triggered source.
- Closing the shift stops the arrival scheduler. Starting the next workday resets the prior queue and creates a new daily queue state.

## Integration and data

The upgrade adds `js/live-queue-engine.js` and integrates it into `js/main.js`. It reuses the existing inbound scenario catalogue, contact lifecycle, queue priority, queue metrics, event timeline, shift record and browser save. There is no new database table and no Supabase migration. Queue state is saved with the existing local game state. Existing profiles with an already-active shift are migrated using their saved shift elapsed time.

## Commercial and technical boundaries

The engine creates fictional game contacts only. It does not connect to a carrier, SIP/WebRTC service, cloud dialler, real CRM, real bank, real customer identity or external contact list. It does not transmit customer data. Voice, email and live-chat provider connectivity remain separate integration work; this upgrade does not claim to complete those channels.

## Source snapshot limitation

The supplied `calloria.zip` did not contain `public/assets/` or the 3D GLB binaries. The cumulative v6.59 source archive preserves all files that were present in that upload but cannot recreate missing 3D assets. Keep any existing local/GitHub `public/assets/` folder when merging this update.

## Acceptance

Use an employed profile, start a shift, keep the browser open while the accelerated shift clock advances, observe automatic arrivals, accept and wrap up contacts, observe a patience-expired abandonment, inspect queue supervisor counters, apply a controlled demand surge, and close the shift. Automated tests cover timing, deterministic scheduling, capacity, abandonment, day reset, migration and application integration; they do not replace this browser acceptance run.
