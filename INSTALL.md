# CALLORIA v1.9 — Supervisor Intervention

## Purpose

Adds an approved supervisor GLB to the existing production Three.js world. When the Customer Intelligence event bridge emits an escalated customer interaction, one supervisor is dispatched from the existing supervisor office zone to reception. Further escalations are queued. The supervisor can resolve the complaint or return the interaction to the original agent through an accessible in-game control panel.

This package does not replace `main.js`, `production-world.js`, `customer-world-integration.js`, `customer-reception-journey.js`, `package.json`, Supabase files, or original GLB models.

## Files

- Replace the root `vite.config.js` with the complete version in this package.
- Add `build/calloria-supervisor-intervention-plugin.js`.
- Add `build/calloria-supervisor-case-bridge-plugin.js`.
- Add `js/supervisor-intervention.js`.
- Add `js/supervisor-intervention-core.js`.
- Add `styles/calloria-supervisor-intervention.css`.
- Add `tests/supervisor-intervention.test.mjs`.

Keep all existing Vite plugins and build inputs. The supplied config preserves the current main-branch config and registers the new plugin last with `enforce: 'post'`, so it runs after the existing customer-world transform.

## Required model approval

In CALLORIA, open `/asset-inspector.html` and approve `Office Female` in the Supervisors category. The runtime only loads the approved supervisor model. It checks model dimensions, rig, bones, triangle budget and texture dimensions before adding it to the production scene. The `bad-supervisor` asset is a fallback only when it is explicitly approved and `office-female-supervisor` is not approved.

If no eligible model is approved or the model has no compatible walking animation/leg bones, the game remains operational and shows a clear supervisor-model availability message. It does not substitute an unrelated character.

## In-game behaviour

- `calloria:customer-reaction` with `status: 'escalated'` dispatches the supervisor.
- One supervisor handles one escalation at a time; additional cases queue without duplication.
- When the supervisor arrives, the in-game panel offers `Record supervisor review` or `Return case to agent`.
- `Record supervisor review` saves a supervisor disposition to the active synthetic Customer Intelligence Lab session and operation timeline, then returns the supervisor to the office.
- `Return case to agent` records that the case was handed back and returns the supervisor to the office.
- The customer session remains `escalated`; mandatory QA review is not silently closed or downgraded. The user must still finalise the escalated practice case through CALLORIA's existing QA flow.
- A customer completed in the existing engine while the supervisor is en route also sends the supervisor back.

## Tests

The package includes Node's built-in test suite at `tests/supervisor-intervention.test.mjs`. It covers queueing, de-duplication, phase transitions, completion, disposal and both Vite transformation contracts. The main application source is not edited; a guarded Vite post-transform adds a small event bridge to the existing application state.

Full Vercel build and actual browser rendering must still be verified in the deployed project. This package has not been deployed to the repository.
