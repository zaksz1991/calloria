# CALLORIA v7.18 — Digital SLA Triage

Additive source overlay for the existing synthetic email, live-chat and social queues.

## Included files

- `js/digital-triage-engine-v718.js` — pure SLA-first ranking and ageing fairness logic.
- `build/calloria-digital-sla-triage-v718.mjs` — source-safe Vite transform for the two digital queue render paths.
- `tests/digital-sla-triage-v718.test.mjs` — focused engine and transform regression suite.
- Installation, source-baseline, changelog and verification notes.

## Runtime behaviour

Both the active-agent quick queue and the full digital waiting queue are sorted by:

1. SLA state: breached, at risk, on track, then unavailable.
2. Effective priority: existing business priority plus a bounded ageing boost.
3. Oldest waiting time.
4. Stable contact identifier as a deterministic tie-breaker.

A contact receives one ageing point per 15 simulated minutes, capped at three points. Ageing never moves an on-track contact ahead of an SLA-breached or at-risk contact. Each queue row receives a short explanation badge.

The existing `sortDigitalQueue` and `assessDigitalSla` functions are injected by the transform. There is no second SLA policy, no new queue state and no save-schema change.

## Scope

This package is an additive overlay, not a complete repository replacement. It does not accept contacts automatically, reassign ownership, mutate deadlines, change customer records, or connect to real digital inboxes.
