# CALLORIA v6.6 — Email & Live Chat Handling

## Purpose

This upgrade gives Email and Live Chat their own customer-facing handling workflow inside CALLORIA's existing playable Live Floor. Voice continues to use the v6.5 simulated telephony controls. Social, SMS and In-app retain their existing interaction flow.

## What changed

### Email
- A distinct email response workspace appears for Email contacts.
- The agent completes the three existing understand, investigate and resolve stages before the final email composer unlocks.
- Subject and message body are editable and saved with the active browser-local interaction.
- A mechanical quality checklist checks the subject, greeting, acknowledgement, action taken, next step/update expectation, sign-off, message length and unfilled template placeholders. It is a text-pattern check, not semantic AI review.
- The send control blocks incomplete replies and requests for passwords, PINs or one-time codes.
- The final response is added to the customer interaction transcript. The three internal investigation choices do not appear as three separate outbound emails.
- Simulated response targets are measured in shift minutes: P1 60, P2 120, P3 240 and P4 360. The completed record stores the email quality score and whether the target was missed.
- An email response is mandatory before the agent can save the contact wrap-up.

### Live Chat
- A separate chat composer appears for Live Chat contacts.
- The agent writes a customer-facing response for each of the three handling stages.
- Service decision buttons remain locked until a reply is prepared for the current stage.
- Selecting the service action commits the prepared text to the transcript and reveals the next scripted customer response.
- Each stage can be answered only once; unsafe requests for credentials are blocked.
- The session records the three reply times and exposes average reply time in the shift report.
- All three chat turns must be recorded before wrap-up.

### Shared gameplay
- Email and chat sessions persist with the active contact in browser local storage, including their drafts and progress.
- Email and chat records appear in the completed-contact table and end-of-shift performance report.
- Existing Customer 360 case creation/update and knowledge-article use remain part of wrap-up.
- Responsive layouts support desktop and mobile screens.

## Files in this overlay

Copy these four files from `public/` into the repository's existing `public/` folder, replacing the three existing Live Floor files and adding the new engine:

1. `live-floor.html`
2. `live-floor.css`
3. `live-floor.js`
4. `digital-channel-engine.js` — new

Do not replace the existing `voice-call-engine.js`; keep the working v6.5 copy in place. The v6.5 voice engine is included only as a test fixture for regression tests in this package.

## Required existing dependencies

Keep the matching prior CALLORIA engines already used by your Live Floor:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`
- `office-routine-engine.js`
- `customer-dynamics-engine.js`
- `voice-call-engine.js` (v6.5)

Keep the existing `public/assets/models/` directory and all 3D workplace files. This patch does not modify Vite configuration, Supabase settings or the office-floor page.

## Route

The existing route remains:

`/live-floor.html`

Vite's existing `public/` handling serves the new engine at `/digital-channel-engine.js`. No Vite configuration change is required.

## Gameplay flow

1. Clock in at Staff Reception in the 3D Workplace, then attend required shift briefings.
2. Accept an Email or Live Chat contact from the existing queue.
3. Complete the three customer-care decision stages.
4. For Live Chat, prepare one customer-facing reply before each service action. For Email, complete the investigation before composing the single final email.
5. Complete the channel-specific response controls, then save the ordinary customer case/note wrap-up.
6. The completed record stores the channel-specific service measures alongside existing QA, CSAT, FCR and compliance results.

## Boundaries

This is a gameplay simulation, not a production messaging platform. Email replies are not delivered to real inboxes; live chats are not connected to visitors or a chat provider. Customer follow-ups remain scripted scenario data. There is no external email API, live chat socket, attachment transfer, shared inbox, multi-agent concurrency or central Supabase record storage in this upgrade.

Email SLA targets use CALLORIA's simulated shift-minute clock, not real-world elapsed time or a contractual service commitment. The email response quality score and chat reply timing are additional channel-specific measures; they do not independently certify compliance or replace the existing QA score.

All new state remains in browser local storage on the same browser and origin. Do not use real customer personal information. No Groq key, external AI service or new third-party service is used.
