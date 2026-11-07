# CALLORIA — Contact Centre Career & Operations Simulator

**Build:** 0.6.0 — Voice Practice, Workforce Operations & Character Activity  
**Product:** A browser-first contact-centre career and operations simulator. Recruitment is the entry gate; the main experience is simulated employment, customer operations, workforce routines and career progression.

## What changed in 0.6.0

### Optional voice practice
- Added an optional customer-statement playback action using the browser's speech synthesis capability.
- Added explicit microphone consent before any audio capture or live transcription.
- Added up to 30 seconds of local microphone sample recording and in-page playback using `MediaRecorder` when supported.
- Added optional browser speech recognition with an `en-NG` language hint when the browser exposes the API.
- Added a typed-response fallback for browsers and devices without microphone or speech-recognition support.
- Added transcript sanitation for PINs, OTPs, passwords, account/card details and long payment-card digit sequences.
- Kept audio blobs, object URLs and transcripts in temporary page memory only. They are not added to the employment save or uploaded by CALLORIA. Voice tools are stopped and temporary media references are cleared when the page is hidden or unloaded.
- Added a visible privacy notice explaining that browser speech recognition may be processed by the browser's speech service.

### Agent state and shift operations
- Added agent states: Available, Busy, Wrap-up, Break and Offline.
- Added an 08:00–17:00 simulated work schedule with morning, lunch and afternoon break windows.
- Added minute-based schedule adherence, including late-start and break deviations.
- Added state transitions when inbound/outbound contacts begin, enter after-contact work, complete or are cancelled.
- Added a single-shift-per-simulated-workday rule and an explicit next-workday action so players are not forced to wait through an overnight clock cycle.
- Added shift history with recorded adherence results.
- Added team-leader coaching records with feedback, action plans, score and follow-up date.

### Character activity
- Added agent activity state updates to the 3D workplace layer.
- Desk GLB characters can cross-fade between available animation clips whose names match working, typing, writing, idle, seated or rest states.
- Local fallback desk characters have restrained arm motion for working and listening states.
- Existing GLB asset references remain external runtime assets; their licensing, browser loading and animation coverage are not verified in this release.

### Preserved capabilities
- Recruitment application, assessment, practical call simulation and employment acceptance.
- Prioritised inbound queue, scripted customer scenarios, hold/resume, transfer, supervisor requests and after-contact work.
- Outbound campaigns, callbacks, suppression controls and dispositions.
- CRM cases, operational timeline, knowledge base, performance and career views.
- Morning and afternoon briefings, specialist department assignment, annual promotion attempts, cross-selling, commendations and synthetic enterprise-system workflow records.
- Desktop movement, first-person 3D workplace and mobile touch controls.

## Current operating model

The simulation clock advances 30 in-game seconds for each real second. A full nine-hour shift therefore takes 18 real minutes when left running continuously. The player begins at 07:00, can attend the 07:30 morning briefing, and may start the scheduled shift from 08:00. The 14:00 afternoon briefing is available in its scheduled in-game window.

Default break windows are 10:00–10:15, 12:30–13:00 and 15:00–15:15. The player must manually start and end each break. Break adherence is calculated against the configured schedule.

Voice practice is supplemental to the existing scripted call decision flow. A recorded sample or speech transcript does not currently drive scenario branching or automatic QA scoring. Customer statement playback depends on the browser's speech synthesis voice availability. Microphone recording and speech recognition depend on browser/device support and explicit permission.

## Build and hosting

Requires Node.js 22.12 or later. The application is configured for Vite production builds and Vercel hosting.

Vercel settings:

- Framework: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

The project includes automated syntax and regression checks in its package scripts. The supplied deployment guide uses GitHub Desktop and the Vercel dashboard for the normal GUI-based release path.

## Simulation and privacy boundaries

- All customers, calls, account records, cases, campaigns, callbacks, salaries and performance values are synthetic gameplay data.
- The enterprise systems sandbox does not connect to real ICC, CRM, Finacle or other bank systems and cannot initiate real transactions.
- The application does not place real telephone calls or connect to live customer queues.
- Local profile and operational records remain in browser local storage. They are not server-backed, tenant-scoped or synchronised across devices.
- Optional audio samples and transcripts remain in page memory only and are not persisted in the employment save. Browser speech recognition may use a browser-controlled recognition service; this is disclosed before use.
- Do not use real customer data or speak PINs, passwords, OTPs, full account numbers or payment-card details during practice. Redaction is a defensive filter, not a guarantee that every sensitive phrase can be detected.
- Voice practice currently supports player sample capture and browser transcription, not a live AI customer conversation or automatic voice-based call scoring.
- Animation switching depends on matching clips in the loaded character GLB. If the selected third-party model has no matching clips, the corresponding animation cannot be shown. Approved first-party assets must replace external runtime references before commercial release.
- This is a development simulator, not a finished commercial product or a certified contact-centre workforce platform.

## Project structure

```text
CALLORIA-v0.6.0/
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── vercel.json
├── js/
│   ├── main.js
│   ├── operations-engine.js
│   ├── workforce-engine.js
│   ├── shift-engine.js
│   ├── voice-engine.js
│   └── production-world.js
├── assets/
│   └── calloria-mark.svg
├── tests/
│   ├── calloria.test.mjs
│   ├── operations-engine.test.mjs
│   ├── workforce-engine.test.mjs
│   ├── shift-engine.test.mjs
│   └── voice-engine.test.mjs
└── project documentation
```

## Release verification

- JavaScript syntax checks: passed.
- Automated tests: 40/40 passed.
- ZIP integrity: checked when the release archive is packaged.
- Vite production bundle: not verified in this environment unless the final dependency installation and build succeed.
- Browser microphone permissions, actual speech recognition, audio output, 3D animation-clip transitions, GLB runtime loading and Android/iOS physical-device QA: not independently verified.

Build 0.6.0 is a development milestone. It adds optional local voice practice and workforce routines while retaining scripted customer interactions. Multi-channel email/chat/social operations, server persistence and multi-user organisation support remain future milestones.
