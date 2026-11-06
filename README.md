# CALLORIA — Contact Centre Career & Operations Simulator

**Build:** 0.4.0 — contact-centre operations engine  
**Product:** A multi-industry contact-centre career and operations simulator. Recruitment is the entry gate; the main gameplay is simulated employment, customer operations, service performance and career progression.

## What changed in 0.4.0

### Inbound operations engine
- Added structured inbound contact records with unique IDs, scenario links, queue entry timestamps, routing groups, priority and lifecycle history.
- Added priority-first routing: fraud, suspicious activity and security reports are routed ahead of routine contacts; higher-risk service issues are elevated above normal enquiries.
- Added lifecycle states for queued, offered, connected, on hold, transferred, wrap-up, callback, completed, escalated and abandoned contacts.
- Added hold/resume, return-to-queue, specialist transfer and supervisor assistance controls during active calls.
- Added after-contact work. Agents must choose a final disposition and provide factual notes before an interaction can be completed.
- Added callback scheduling with future-time validation and return-to-queue controls. Scheduled callbacks cannot be placed into the queue early.

### Outbound campaign controls
- Added unique simulated dial-attempt references and event history.
- Added mandatory after-contact notes and disposition recording.
- Added a contact suppression register. A recorded customer opt-out blocks further simulated campaign attempts for that contact.
- Added scheduled outbound callbacks with due-time checks, callback continuation and suppression checks.
- Ensured a callback is only marked complete after the replacement disposition and any requested callback time pass validation.
- Corrected outbound callback completion to resolve by callback ID instead of depending on an inbound queue record.
- Recorded an explicit customer cancellation decision as a declined retention outcome.
- Added safe cancellation of an incomplete outbound attempt; it does not receive completion credit.

### Supervisor, CRM and performance
- Added a supervisor assistance desk for open requests, escalated cases and recent operational events.
- Expanded CRM case records with disposition, factual notes, owner and event history.
- Added a searchable-by-history interaction timeline view in CRM.
- Added queue wait, service-level snapshot, after-contact work and accepted-contact metrics.
- Added Queue and Supervisor entries to the game navigation and 3D workstation interaction panel.

### Engineering
- Extracted queue and contact lifecycle rules into `js/operations-engine.js` so operational state is separated from screen rendering.
- Added unit tests for contact creation, queue priority, lifecycle transitions, metrics, suppression and callback validation.
- Preserved the v0.3.0 game shell, mobile controls, recruitment flow, existing inbound/outbound scenarios, CRM, knowledge base, performance and career progression.

## Existing experience retained

- CALLORIA game-first interface and immersive 3D contact-centre workplace.
- Desktop WASD/arrow movement, mouse look, sprint and workstation interaction.
- Touch joystick, drag-to-look, run and workstation-use controls.
- Candidate application, aptitude/judgement/security assessment and practical call assessment.
- Employment offer and acceptance gate.
- Existing inbound scenarios and outbound campaign scripts.
- Simulated CRM, knowledge base, performance dashboard, salary/bonus and career progression.
- Vite-managed Three.js and Vercel build configuration.

## Run and build

Requires Node.js 22.12 or later.

- `npm run dev` — local Vite development server.
- `npm run check` — JavaScript syntax checks.
- `npm test` — automated regression and operations-engine tests.
- `npm run build` — Vite production build.
- `npm run preview` — preview the production bundle.

Vercel settings:

- Framework: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Important simulation boundaries

- All calls, customers, accounts, cases, campaigns, callbacks, salary and performance data are simulated. The game does not place real calls or access real customer records.
- Queue routing and supervisor actions are single-player simulation logic. They are not a real multi-agent ACD, workforce platform or live supervisor connection.
- Contact records, callback schedules and suppression preferences are stored in browser local storage. They are not synchronised across devices and are not protected server-side records.
- Voice conversations, microphone capture, email, live chat, social messaging, multiplayer and multi-organisation administration are not implemented in this release.
- Customer dialogue remains scenario-driven rather than live AI-generated voice dialogue.
- Current human and reception GLB assets are still external runtime references. They have not been bundled or independently browser-verified; approved commercial assets must be versioned and hosted first-party.

## Project structure

```text
CALLORIA-v0.4.0/
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── vercel.json
├── js/
│   ├── main.js
│   ├── operations-engine.js
│   └── production-world.js
├── assets/
│   └── calloria-mark.svg
├── tests/
│   ├── calloria.test.mjs
│   └── operations-engine.test.mjs
└── project documentation
```

## Release verification

- JavaScript syntax checks: passed.
- Automated tests: 18/18 passed.
- ZIP integrity: to be checked when release archive is produced.
- Vite production bundle: not verified. Vite was not installed in this environment; dependency installation timed out while waiting on the package registry.
- Full browser walkthrough, GLB runtime loading, desktop 3D rendering and physical-device QA on Android/iPhone: not verified.

Build 0.4.0 is an operations-engine development release, not a finished commercial product. It materially expands operational depth but does not yet deliver real voice, digital channels, server persistence or multi-user operations.
