# CALLORIA v7.16 — Digital Customer-State Integrity

## Defect corrected

`digitalQueueMetrics()` previously populated `awaitingCustomer` by counting `DIGITAL_STATUS.PENDING_CUSTOMER`. That status is used when an agent completes a digital interaction with a pending-customer disposition. It is distinct from `DIGITAL_STATUS.AWAITING_CUSTOMER`, which means an assigned digital thread is waiting for a customer reply while it remains part of active agent work.

## Changes

- Counts active digital threads in `awaitingCustomer` using `DIGITAL_STATUS.AWAITING_CUSTOMER`.
- Adds `pendingCustomerCases` for completed digital interactions dispositioned as pending customer.
- Splits the Digital service performance display into two explicit rows: active threads awaiting a customer, and CRM cases pending customer.
- Uses a guarded Vite post-transform. Exact source-anchor checks prevent partial edits and emit a warning when the source has drifted.
- Adds a standalone pure metrics helper. No queue record is mutated.

## Compatibility

- No save-schema migration.
- No Supabase changes or environment variables.
- No customer, agent, queue, SLA, QA or case lifecycle actions are changed.
- The new Vite plugin must be registered once after other `main.js` transforms.
- The existing v7.15 coach can remain installed; v7.16 does not depend on it.
