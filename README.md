# CALLORIA v6.4 — Adaptive Customer Behaviour & Service Interaction

## Purpose

This is a core gameplay upgrade for the existing CALLORIA Live Floor. It makes customer interactions react to the agent's decisions instead of showing only fixed scripted exchanges. It does not add a banking or accounting feature and does not change the 3D workplace scene.

## What's new

- Eight deterministic customer profiles mapped from the existing scenario tones: concerned, frustrated, impatient, upset, positive, formal, curious and neutral.
- Live customer rapport, patience and trust signals during an interaction.
- Customer mood changes after each of the three service decisions.
- Contextual customer reactions are appended to the existing scripted conversation.
- Agent service cues change with the customer's current emotional state.
- Final customer sentiment adjusts the customer-experience score. Objective QA scoring remains separate and is not increased by rapport.
- Critical compliance breaches remain critical and cannot be offset by good rapport.
- Optional floor-supervisor assistance request with a required reason. The request is written to the local interaction notes and included in the completed interaction evidence.
- Dynamics persist inside the existing active shift record and are attached to the completed contact record.
- Existing shifts without dynamics data are upgraded when the interaction is opened; previous shift fields and decision history are preserved.

## Installation

This is an additive overlay for the v6.3 CALLORIA stack. It depends on the existing v6.3 `office-routine-engine.js`, v6.1 `career-progression-engine.js`, and the existing v6.0-compatible agent, customer-journey and live-floor engines.

Copy the four files from this package's `public` folder into the existing repository `public` folder, replacing the three matching Live Floor files and adding the new customer dynamics engine:

1. `live-floor.html` — replace.
2. `live-floor.css` — replace.
3. `live-floor.js` — replace.
4. `customer-dynamics-engine.js` — add.

Do not remove or replace the existing `agent-workbench-engine.js`, `customer-journey-engine.js`, `live-floor-engine.js`, `career-progression-engine.js`, `office-routine-engine.js`, the 3D office files or the GLB model directory.

The Live Floor URL remains:

`https://calloria.vercel.app/live-floor.html`

The 3D Workplace URL remains:

`https://calloria.vercel.app/office-floor.html`

## Gameplay flow

1. Accept a customer from the existing queue.
2. Review the customer's profile, opening tone and needs.
3. Use the three service decisions to understand, investigate and resolve the issue.
4. Watch rapport, patience, trust and customer mood react to each decision.
5. Review the latest customer signal and service cue before continuing.
6. Request floor-supervisor support when needed and record a reason.
7. Complete the existing CRM/case wrap-up. Customer experience evidence is saved with the completed interaction.

## Important boundaries

- Customer behaviour is deterministic and rules-based. It is not an AI conversation model.
- The conversation remains synthetic; there are no real phone calls, emails, live chats, social messages or customer accounts.
- Supervisor assistance is a local simulation note. It does not notify a real person, deliver a request to the v4.7 Supervisor Console, or create a shared cross-device work item.
- Rapport is a gameplay/customer-experience signal, not a psychological assessment of a real person.
- Existing QA scoring remains separate from customer sentiment. A critical compliance failure is never erased by a positive customer reaction.
- Data remains in browser local storage. This release does not introduce Supabase, Groq, external AI APIs or new authentication.

## Tests

Run the included tests with Node.js:

`node --test tests/*.test.cjs`

The `tests/fixtures` folder contains test-only copies of the v6.0-compatible agent, customer journey and live-floor engines used to exercise the v6.3 stack contracts. They are not copied into the production `public` folder by this patch.
