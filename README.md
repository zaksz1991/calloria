# CALLORIA v4.7 — Supervisor & QA Operations

An additive supervisor-console page for the CALLORIA Vite application. This package does not replace existing project files and does not modify the application entry point, Vite configuration, onboarding, agent gameplay, GLB assets or existing operations pages.

## Included

- Supervisor overview with contact, QA, escalation and handled-contact indicators.
- Multi-channel interaction queue for voice, email, live chat and social contacts.
- Search and filters for channel, status and priority.
- Interaction transcript inspection with controls to start a monitoring record, request supervisor assistance, mark a contact complete or raise an escalation.
- Weighted 100-point QA scorecard with six service criteria.
- Critical-fail rule: verification/data protection or accuracy below 3/5 caps the result at 49.
- QA evaluation history and latest agent QA score update within the local demo roster.
- Coaching register with observed behaviour, agreed action, review date and status tracking.
- Escalation register with ownership, priority, status and resolution notes.
- Team performance snapshot.
- Local browser persistence with a reset-demo control.

## Installation

Copy the four files in this package's `public/` folder into the existing CALLORIA repository's `public/` folder. Keep the existing files. Do not replace `vite.config.js`, `main.js`, the existing agent desk, OJT code or model files.

After the updated application is built and served, open:

`/supervisor-qa.html`

For the current Vercel project, the expected route is:

`https://calloria.vercel.app/supervisor-qa.html`

This route becomes available only after the new public files are included in the deployed project.

## Data and integration boundary

This is an isolated demonstration page. It does not yet read or write CALLORIA's central CRM, employee records, workforce management, telephony provider, real email/chat/social accounts, live voice audio, QA backend or multiplayer sessions. Agent names, contacts, conversations, statuses, metrics and existing escalations are synthetic sample records. Changes are stored in the browser's `localStorage` under `calloria.supervisor-qa.v47`; they are not shared across users or devices.

The monitoring control records a local supervisor monitoring state; it does not silently join a real telephone call or capture audio. Completing a contact makes it eligible for this page's QA review only. No external messages or customer contacts are sent.

## Files

- `public/supervisor-qa.html` — standalone page and layout.
- `public/supervisor-qa.css` — responsive supervisor-console styling.
- `public/supervisor-qa.js` — browser UI and interaction handling.
- `public/supervisor-qa-engine.js` — scorecard, state, metrics and record helpers.
- `tests/supervisor-qa-v47.test.mjs` — focused tests for core engine logic.
- `CHANGELOG.md` — release notes.
- `VERIFICATION.md` — exact verification performed and limitations.
