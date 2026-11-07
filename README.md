# CALLORIA — Contact Centre Career & Operations Simulator

**Build:** 0.7.0 — Multi-channel Customer Operations  
**Product:** A browser-first contact-centre career and operations simulator. Recruitment is the entry gate; the main experience is simulated employment, multi-channel customer operations, workforce routines and career progression.

## What changed in 0.7.0

### Multi-channel customer support
- Added a digital operations desk for synthetic email, live-chat and social-media enquiries.
- Added six scripted sample contacts across the three channels, including a public POS complaint, a mobile access issue, a transfer investigation and service feedback.
- Added priority-aware sorting, channel filters, specialist routing groups, assigned-agent records and queue refresh.
- Added conversation threads, editable channel-specific response starters, agent replies and optional scripted customer follow-up.
- Added explicit after-contact dispositions: resolved, pending customer and escalated.
- Added mandatory factual notes, CRM case creation and preserved digital transcript details when the interaction is closed.
- Added separate channel workload, first-response, response-target risk, resolution, escalation and practice-QA metrics.
- Added digital activity to the overall performance dashboard and promotion KPI input.

### Privacy and customer protection
- Blocks agent replies that explicitly request a PIN, password, one-time code or full payment-card number pattern.
- Applies an additional practice check to social responses: full-quality privacy handling requires directing account-specific support to a verified/private channel.
- Encourages agents to acknowledge customers, take ownership, explain a next step and leave a traceable record.
- Customer names, messages, references and interactions are synthetic training data only.

### Practice QA boundary
The digital-response check is deterministic and keyword/rule based. It checks acknowledgement, ownership, next-step clarity and privacy handling. It is not an AI model, a certified QA scorecard or a substitute for human review. The example email, live-chat and social response targets are illustrative game values; they are not contractual or regulatory service levels.

## Preserved capabilities
- Recruitment application, aptitude screening, practical call assessment and employment acceptance.
- 3D workplace exploration, desktop movement, mobile touch controls and workstation interaction.
- Prioritised inbound voice queue, scripted calls, hold/resume, transfer, supervisor requests and after-contact work.
- Outbound campaigns, callbacks, suppression controls and dispositions.
- CRM case history, operational event timeline, knowledge base, performance and career views.
- Morning and afternoon briefings, specialist department assignment, annual promotion attempts, cross-selling, commendations and synthetic enterprise-system workflow records.
- Optional consent-based voice practice, local recording, speech recognition where supported and agent shift-state animation selection.
- Shift schedule, breaks, adherence, coaching and shift history.

## Operating model

The simulation clock advances 30 in-game seconds for each real second. A full nine-hour shift therefore takes 18 real minutes when left running continuously. The player begins at 07:00, can attend the 07:30 morning briefing, and may start the scheduled shift from 08:00. The 14:00 afternoon briefing is available in its scheduled in-game window.

Default break windows are 10:00–10:15, 12:30–13:00 and 15:00–15:15. The player must manually start and end each break. Break adherence is calculated against the configured schedule. An agent must complete the active call or digital conversation before taking a break or ending the shift.

## Multi-channel workflow

1. Start the simulated shift and open Digital.
2. Filter the queue by Email, Live chat or Social media, or inspect all channels.
3. Accept a priority-routed synthetic customer contact while the agent is available.
4. Read the customer thread and channel handling guide.
5. Write a reply. Unsafe credential solicitation and full payment-card-number patterns are blocked.
6. Receive the scripted customer follow-up where one is available.
7. Complete after-contact work using a resolved, pending-customer or escalated disposition and factual notes.
8. Review the resulting CRM case and channel metrics in the Cases and Stats views.

A digital interaction occupies the agent until it is completed or placed into a documented pending-customer/escalation disposition. The current version does not simulate several concurrent chats for one agent.

## Build and hosting

Requires Node.js 22.12 or later. The application is configured for Vite production builds and Vercel hosting.

Vercel settings:

- Framework: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

The project includes automated syntax and regression checks in its package scripts. The deployment guide uses GitHub Desktop and the Vercel dashboard for the GUI-based release path.

## Simulation and privacy boundaries

- All people, customers, conversations, platform messages, cases, accounts, campaigns, callbacks, salaries and performance values are synthetic gameplay data.
- The digital operations desk does not connect to Gmail, Outlook, Instagram, Facebook, X, WhatsApp, live chat providers or other external channels.
- The enterprise systems sandbox does not connect to real ICC, CRM, Finacle or other bank systems and cannot initiate real transactions.
- The application does not place real telephone calls or connect to live customer queues.
- Player progress and operational records remain in browser local storage. They are not server-backed, tenant-scoped or synchronised across devices.
- Optional audio samples and transcripts remain in page memory only and are not persisted in the employment save. Browser speech recognition may use a browser-controlled recognition service; this is disclosed before use.
- Do not use real customer data or enter PINs, passwords, OTPs, full account numbers or payment-card details during practice. The response filter is defensive and is not guaranteed to detect every unsafe phrase or number format.
- Voice practice does not drive customer scenario branching or automatic voice QA scoring.
- Digital practice scoring is deterministic and must not be treated as an approved organisational scorecard.
- GLB animation switching depends on compatible clips in the selected character asset. External model licensing, loading, CORS and animation coverage remain to be verified.
- This is a development simulator, not a finished commercial product or a certified contact-centre workforce platform.

## Project structure

```text
CALLORIA-v0.7.0/
├── index.html
├── styles.css
├── vite.config.js
├── package.json
├── vercel.json
├── js/
│   ├── main.js
│   ├── operations-engine.js
│   ├── multichannel-engine.js
│   ├── workforce-engine.js
│   ├── shift-engine.js
│   ├── voice-engine.js
│   └── production-world.js
├── assets/
│   └── calloria-mark.svg
├── tests/
│   ├── calloria.test.mjs
│   ├── operations-engine.test.mjs
│   ├── multichannel-engine.test.mjs
│   ├── workforce-engine.test.mjs
│   ├── shift-engine.test.mjs
│   └── voice-engine.test.mjs
└── project documentation
```

## Release verification

- JavaScript syntax checks: passed in the release preparation environment.
- Automated regression tests: 55/55 passed in release preparation.
- ZIP integrity: checked when the release archive is packaged.
- Vite production bundle: only reported as passed if dependencies are available and `vite build` completes.
- Browser UI, message flow, screen-reader/accessibility behaviour, 3D asset loading, WebGL rendering, and physical-device QA on Android/iOS require browser/device verification.
- No GitHub commit or Vercel deployment is implied by this ZIP package.

Build 0.7.0 is a development milestone. It adds scripted multi-channel written customer support and shared CRM case records. External platform integrations, multi-agent concurrency, server persistence and multi-tenant organisation management remain future milestones.
