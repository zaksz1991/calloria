# Source baseline — CALLORIA v7.17

Target: current public `main` source structure inspected for this release.

Key integration points:

1. `js/main.js` imports the multichannel engine from `./multichannel-engine.js`.
2. The digital close form contains a `DISPOSITION` selector with `resolved`, `pending_customer` and `escalated` values.
3. `finishDigitalContact(form)` reads the submitted disposition and calls `completeDigitalContact(...)` before adding the corresponding `digitalCase` to `state.cases`.
4. The existing supervisor escalation card renders `request.reason` before its `.supervisor-escalation-meta` container.
5. `vite.config.js` registers the application plugins and ends with `calloriaTryItStudioPlugin()` in the inspected public baseline.

The v7.17 Vite plugin checks each of these `main.js` anchors exactly once. If an anchor is missing or duplicated, it raises a clear build error without returning a partially transformed file. The source marker makes the transform idempotent.

## Design constraints

- Handoff records are created only in the simulator's local state.
- New records deliberately use `linkedCaseReference`, not the legacy `caseReference` property, so the existing generic supervisor claim/review card path remains active.
- Destination selection does not change case ownership or assign a named specialist.
- Restricted provider-backed WhatsApp and SMS inboxes are not touched.
