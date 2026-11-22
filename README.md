# CALLORIA v7.13 — Callback Attempt Outcome Integrity

Cumulative source overlay based on the public `main` source audit performed on 22 November 2026.

## What it repairs

- A cancelled outbound callback was being labelled `completed` even when no verified after-contact result existed.
- Outbound callbacks that ended as no-answer, busy or voicemail were also being labelled `completed` before the commitment retry path ran.
- An inbound callback returned to the queue could remain stuck in `in_progress`.
- The outbound campaign retry path used an arbitrary `now + 60 seconds` value for its worklist due time instead of the linked commitment callback's due time.

## Behaviour after v7.13

- Only a reached customer interaction becomes callback status `completed`.
- no-answer, busy, voicemail and interrupted attempts become `attempt_failed` and keep a bounded attempt history.
- Returning an inbound callback to the queue returns its callback task to `queued`; the commitment remains open.
- An interrupted outbound callback keeps its commitment open and creates a supervisor review request rather than falsely fulfilling the promise.
- When a promise retry is scheduled, the campaign worklist uses exactly the same due timestamp as the callback record and formal commitment.
- The v7.12 integrity audit treats `attempt_failed` as terminal attempt evidence, so an open promise without a replacement task is reported as missing an active task.

No real calls are placed. Records remain synthetic local simulation data. The helper never stores call transcripts, authentication secrets or customer notes.

## Package scope

This ZIP carries forward the v7.12 callback-integrity audit (plugin, engine, stylesheet and test) and adds the v7.13 callback-attempt engine, Vite transform and regression tests. It is an overlay, not a full application repository.
