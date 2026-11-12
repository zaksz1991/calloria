# CALLORIA v6.9 — Customer Commitments & Callback Management

## Purpose

This upgrade closes the service loop after the first customer interaction. Agents can schedule an explicit callback promise during wrap-up, see upcoming/due/overdue commitments on the Live Floor, record each outbound attempt, update Customer 360 and the linked case timeline, and send repeated unsuccessful callbacks to a documented review step.

The release keeps the central game focused on customer care. It does not add a bank, billing, accounting or ERP gameplay system.

## Gameplay

### Schedule a customer promise during wrap-up
- Optional callback plan: 30 simulated minutes, 60 simulated minutes, next working day at 09:00, or two working days at 10:00.
- The promise description is mandatory when a callback is selected.
- A `Callback agreed` disposition cannot be saved without a scheduled commitment.
- Same-shift callbacks that would fall after the 16:00 close are automatically moved to the next working day at 09:00.
- Next-working-day calculation skips Saturday and Sunday.
- Simulated minutes are based on the in-game shift clock. They are not real-time countdowns or outbound call automation.

### My callback commitments
- Separate list for the signed-in employee.
- Displays customer, originating contact, linked case, channel, commitment, due date/time and attempt count.
- Shows Scheduled, Due soon, Due, Overdue and Needs review states.
- Overdue and review work are sorted ahead of future commitments.
- Open commitments remain visible across shifts in the same browser and origin.

### Record callback outcomes
- Customer reached and commitment fulfilled: closes the commitment.
- No answer: records an internal outbound attempt and reschedules for the next working day at 10:00.
- Further action required: records the customer-facing interaction and reschedules for the next working day at 10:00.
- The outcome note must contain at least 20 characters.
- Every attempt adds a note to the customer record and, when a linked case is still open, an outbound interaction to that case.
- After two unsuccessful attempts, the commitment moves to Needs review. It cannot be closed through another normal callback outcome.

### Manager review
- Closing a Needs review item requires a named reviewer different from the callback owner and a written review outcome.
- Review outcome is recorded as a Customer 360 internal note.
- Reviewer names are entered in the simulation and are not authenticated against an HR identity system. This is a gameplay control, not a real approval/security boundary.

### Performance evidence
- Completed contact records carry the callback reference and promised due time.
- End-of-shift report shows open, overdue and review-required customer commitments.
- Existing queue routing, all six contact channels, voice controls, customer dynamics, career progression and 3D office links remain intact.

## Installation

This is an additive overlay for the current CALLORIA v6.8 Live Floor. Copy these files from the ZIP's `public/` folder into the repository's existing `public/` folder:

Replace these three matching Live Floor files:
1. `live-floor.html`
2. `live-floor.css`
3. `live-floor.js`

Add the new engine:
4. `commitment-engine.js`

The ZIP also contains the v6.8 compatibility copies below. Preserve your own versions if they have been customised; the v6.9 Live Floor still needs them:
- `queue-routing-engine.js`
- `digital-channel-engine.js`
- `social-messaging-engine.js`

Keep all other existing runtime dependencies and assets already in your repository:
- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`
- `office-routine-engine.js`
- `customer-dynamics-engine.js`
- `voice-call-engine.js`
- the complete `public/assets/models/` directory and existing 3D workplace files

Do not replace the Vite configuration, Supabase configuration, 3D office pages or unrelated modules. No environment variables or external API keys are required.

## Route

The existing Live Floor route remains `/live-floor.html`.

New engine asset: `/commitment-engine.js`.

## Verification performed

- **136 focused and regression tests passed, zero failed.** This includes the previous v6.5 voice, v6.6 digital, v6.7 Social/SMS/In-app and v6.8 routing tests, plus v6.9 commitment-engine and Live Floor contract checks.
- JavaScript syntax checks passed for all JavaScript files included in the overlay.
- HTML duplicate-ID check passed.
- All 173 direct controller ID selectors were found in the HTML.
- Commitment engine script load order check passed.
- Local static HTTP smoke check returned HTTP 200 for all seven page/engine/style assets included in the overlay.
- ZIP archive integrity passed.

A full repository Vite production build, Vercel deployment and browser visual/end-to-end acceptance were not performed. The overlay does not include the full project repository or all runtime dependencies needed for a production build.

## Boundaries

- Callback commitments are synthetic gameplay records. No real telephone call, email, SMS or message is sent.
- Due times use the simulated shift date/minute counter. They only advance when game actions advance the shift clock; they are not real-world timers or background reminders.
- Commitment data is stored in browser local storage, per employee name. It does not sync to Supabase, another browser, another device or a multi-user team queue.
- Customer notes and linked case interactions write to the existing browser-local Customer 360 store on the same origin.
- A reviewer name is typed into the simulation; it is not validated through sign-in or HR permissions.
- The engine does not use AI, Groq, external APIs, web sockets, real telephony or any additional third-party service.
