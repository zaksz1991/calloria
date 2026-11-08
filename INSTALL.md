# CALLORIA v1.8 — Customer Reception Journey

## What this changes

This upgrade turns the existing static reception customer placements into a small, event-driven walk-in customer journey:

- approved customer GLBs start in the reception waiting area;
- the Customer Intelligence `active` event calls the customer to the counter;
- agent-turn reactions update only the avatar assigned to that scenario;
- `escalated` holds the visitor at the counter and emits `calloria:customer-supervisor-requested`;
- a supervisor UI can respond using `calloria:customer-world-command` with `action: 'supervisor-arrived'`, then `action: 'supervisor-resolved'` or `action: 'resume'`;
- `completed` starts the departure route and hides the visitor after leaving the room;
- when only one avatar is available, additional interactions wait in a FIFO queue.

It uses the existing scene and render loop. No additional WebGL renderer is created. The existing GLB approval checks and procedural fallback remain in place.

## Files

Replace the complete existing file:

- `js/customer-world-integration.js`

Add:

- `js/customer-reception-journey.js`
- `tests/customer-reception-journey.test.mjs`

No other existing application files are replaced.

## Event contract

The existing Customer Intelligence integration already dispatches `calloria:customer-reaction` with `scenarioId`, `emotion`, `reaction`, `turn`, `patience` and `status`.

This upgrade also dispatches:

- `calloria:customer-world-state` — customer state transitions;
- `calloria:customer-supervisor-requested` — escalation requiring supervisor attention.

Supervisor controls can be sent from the browser with:

```js
window.dispatchEvent(new CustomEvent('calloria:customer-world-command', {
  detail: { scenarioId: 'CIL-...', action: 'supervisor-arrived' }
}));

window.dispatchEvent(new CustomEvent('calloria:customer-world-command', {
  detail: { scenarioId: 'CIL-...', action: 'supervisor-resolved' }
}));
```

These commands are event contracts only; this version does not create a supervisor GLB actor or a new supervisor UI. The existing project must subscribe to the escalation event and decide when the supervisor has arrived or completed the intervention.

## Tests

Run the focused regression tests using the project's existing test command or:

```sh
node --test tests/customer-reception-journey.test.mjs
```

The pure journey controller has no Three.js dependency, so these tests do not require a browser or WebGL context.

## Deployment boundary

This package does not modify `vite.config.js`, `js/main.js`, `js/production-world.js`, `package.json`, the customer intelligence engine, Supabase schema, or original GLB files. Existing Vite integration already calls `attachCalloriaWorldCustomers()` and updates the returned layer inside the production render loop.

A successful unit test is not a substitute for the full Vercel build or an in-browser check of the actual customer assets.
