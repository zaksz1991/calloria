# CALLORIA v6.5 — Voice Call Handling & Contact Controls

## Purpose

This upgrade adds a practical simulated telephony workflow to CALLORIA's existing Live Floor. It applies only to contacts whose channel is **Voice**. Email, Live Chat, Social, SMS and In-app contacts keep their existing interaction flow.

## What changed

- A voice-call control panel appears when the agent accepts a Voice contact.
- Live connected-talk and hold timers, with hold time excluded from connected-talk time.
- Place the customer on hold with a recorded reason and resume the call.
- Simulated microphone mute/unmute with mute activation tracking. The browser microphone is never accessed.
- Supervisor consultation workflow: customer-safe context is required, the caller is placed on hold, and the exercise returns a scripted guidance cue before the call resumes.
- Specialist warm transfer is available only after the three customer-care decision stages are complete. It requires a specialist destination, transfer reason and a handover summary of at least 30 characters.
- A transferred Voice contact must use the **Escalated to specialist** wrap-up disposition. A held or consulting call cannot be wrapped up.
- Completed contact records retain connected time, hold time, mute count, consultation count and transfer evidence. Shift reports include voice call totals and handling summaries.
- Active voice session state persists with the active customer interaction in browser storage, including after a page refresh.
- Responsive layout for phone and desktop widths.

## Files in this overlay

Copy these four files from `public/` into the repository's existing `public/` folder, replacing the three matching files and adding the new engine:

1. `live-floor.html`
2. `live-floor.css`
3. `live-floor.js`
4. `voice-call-engine.js` — new

Do not delete or replace the existing model assets or other CALLORIA files.

## Required existing dependencies

This overlay expects the matching prior CALLORIA upgrades to remain installed:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`
- `office-routine-engine.js`
- `customer-dynamics-engine.js`

The v6.5 ZIP does not replace these dependencies, the 3D office files, Vite configuration or Supabase configuration.

## Route

The existing route remains:

`/live-floor.html`

No Vite configuration change is required for these `public/` files.

## How the voice workflow behaves

1. Accept a Voice contact from the existing queue. The simulated call connects and the call timer starts.
2. Use hold/resume and mute controls as appropriate. Decision options are disabled while the call is on hold or a supervisor consultation is in progress.
3. For a supervisor consultation, supply the reason and a concise customer-safe summary. The simulation holds the customer and returns a scripted guidance cue. Complete the consultation to resume the customer.
4. Complete the three service-decision stages. If a specialist handoff is required, complete the warm-transfer fields and record the handoff.
5. Save the customer-care wrap-up. A completed transfer requires the `Escalated to specialist` disposition.

## Boundaries

This is a gameplay simulation, not a production phone system. There is no SIP, WebRTC, real call routing, call recording, live audio, microphone permission, actual supervisor connection or specialist-agent handoff. The supervisor advice is scripted. The transfer creates an internal handover record and marks the contact as transferred in the game; it does not send the customer to a real team.

Records remain in browser local storage and are not shared between agents or devices. No Groq key, external AI provider or new external service is used.
