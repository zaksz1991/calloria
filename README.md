# CALLORIA v7.21 — Digital Follow-up Response Cycle SLA

A self-contained additive upgrade for the current public CALLORIA `main` source.

## What changes

CALLORIA's existing digital SLA engine correctly measures the first agent response and stops that timer when the first response is recorded. It does not measure later customer turns. v7.21 adds a separate read-only timer for each subsequent customer-response cycle.

- Excludes the original first-response cycle so it is not double-counted.
- Starts a new cycle after a customer follows up following an agent reply.
- Groups consecutive customer messages into one pending turn, using the latest message timestamp.
- Uses the existing per-contact `slaMinutes` value; otherwise uses channel targets (email 240m, live chat 2m, social 20m).
- Marks open cycles on track, due soon at 75% of target, or overdue at the target deadline.
- Marks completed cycles met or late based on the next agent message timestamp.
- Rejects a response timestamp that predates its customer turn rather than recording a false SLA success.
- Adds a compact FOLLOW-UP RESPONSE SLA card to the active digital thread.
- Exposes queue-level, channel-level metrics for later supervisor/performance integration.

All timing uses the timestamp passed by CALLORIA's existing `queueSimulationNowMs()` render flow. No live inboxes or external providers are connected.

## Files

- `js/digital-response-cycle-engine-v721.js`
- `build/calloria-digital-response-cycle-v721.mjs`
- `styles/calloria-digital-response-cycle-v721.css`
- `tests/digital-response-cycle-v721.test.mjs`
- `VITE-CONFIG-ADDITIONS-v7.21.txt`
- `INSTALL-GITHUB-v7.21.md`

## Verification summary

20 focused regression tests passed. JavaScript syntax and a transformed `main.js` fixture syntax check passed. A full Vite build and Vercel deployment were not run because a complete checkout of the user's current working tree was not supplied.
