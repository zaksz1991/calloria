# CALLORIA v4.6.0 — Multichannel Operations Workbench

## Purpose
Adds a browser-based, persistent simulated workbench for voice, email and live chat operations. It advances the product beyond recruitment and assessment into daily agent work. It is an additive module; it does not replace the existing CALLORIA application or claim to complete the full v0.2/v4.x roadmap.

## Install
Copy these files into the repository without replacing existing files:
- `public/multichannel-operations.html`
- `public/multichannel-operations.css`
- `public/multichannel-operations.js`
- `tests/multichannel-operations-v46.test.mjs`

Because the existing Vite configuration uses `publicDir: 'public'`, the page is served at `/multichannel-operations.html` after deployment. No Vite config, package manifest, `main.js`, OJT runtime, GLB integration or existing application files are changed.

## Gameplay
1. Open the multichannel operations page and start a simulated shift.
2. Select Voice, Email or Live chat.
3. Select a queued synthetic customer contact.
4. Review the customer context and prior interaction history.
5. Write a response; the deterministic customer simulation responds.
6. Request supervisor assistance when needed.
7. Complete after-contact work; the interaction transcript and QA estimate are stored locally.

The module seeds six fictional contacts across three channels. Records persist in browser local storage under `calloria.multichannel.v46`.

## Scope and limitations
- Voice is a text-based call transcript simulation, not actual audio/telephony.
- Email and live chat are simulated; no real messages are sent.
- The module uses local browser storage only. It is not multi-user, cloud-synchronised or connected to the existing central CRM database.
- QA score is a lightweight simulation estimate, not a validated quality model.
- Supervisor requests are recorded on the interaction; there is no live supervisor console bridge in this additive module.
- No GLB, 3D scene, recruitment, OJT, employment or career files are modified.

## Verification
- `node --check public/multichannel-operations.js` — passed.
- `node --test tests/multichannel-operations-v46.test.mjs` — 4 passed, 0 failed.
- Full repository tests and Vite production build — not run; the complete repository was not available in this task.
- Vercel deployment and browser visual testing — not performed.
