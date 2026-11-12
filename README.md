# CALLORIA v6.0 — Core Contact-Centre Shift Gameplay

## Purpose

This release redirects development to CALLORIA's central game loop: sign in as a customer-care employee, attend operational briefings, accept customer contacts, investigate the customer's issue, select a response, apply approved guidance, record the outcome and review shift performance.

It is **not** a banking simulation, finance application or accounting workflow. The v5.8 Billing and v5.9 Finance modules are not imported, required or displayed by this release. They remain optional back-office add-ons.

## Gameplay in this release

- Employee sign-in without registration.
- A simulated shift beginning at 07:30.
- Mandatory 07:30 morning and 14:00 afternoon product/service briefings.
- Scheduled 10:30 morning break and 12:30 lunch break.
- A ten-contact synthetic queue covering RuffNeck LMS, Prospector, Social Hub, Connect, Kano Run, Kano Keke and general customer-care enquiries.
- Multiple channels: Voice transcript simulation, Email, Live chat, Social, SMS and In-app.
- Three interactive decision stages per contact: understand, investigate and resolve.
- Customer responses, customer context, published knowledge lookup and contact wrap-up.
- Customer 360 case creation, update of an existing case or customer-note-only outcome.
- Quality, CSAT, first-contact resolution, compliance and knowledge-use scoring.
- Shift report and repeatable next-shift cycle with prior-shift report archive.
- Responsive layout for desktop and mobile screens.

## Install

This is a Vite `public/` overlay. No Vite configuration or application entry-point modification is required.

Copy the files from this package's `public/` folder into the repository's existing `public/` folder:

- `live-floor.html`
- `live-floor.css`
- `live-floor.js`
- `live-floor-engine.js`
- `agent-workbench-engine.js`
- `customer-journey-engine.js`

The last two files are compatibility copies from CALLORIA v5.5 and v5.4 so that the new page can load its engine dependencies. If the repository already contains customized versions of those two engines, keep the repository versions and copy only the four `live-floor` files.

After the files are included in a successful deployment, the route is:

`https://calloria.vercel.app/live-floor.html`

This route is not claimed to be live until the repository is updated and Vercel completes a deployment.

## Data and integration boundaries

- The shift session and its isolated agent queue are stored in browser local storage using `calloria.live-floor.v60` and `calloria.live-floor.agent-workbench.v55`.
- Customer notes, cases and knowledge references write to the existing v5.4 Customer 360 local-storage record when it is present or when the v5.4 engine seeds its demonstration records.
- Published knowledge is read from the v5.2 Knowledge Operations local-storage record on the same browser and origin.
- The v6.0 queue is isolated from the v5.5 Agent Workbench queue. It does not silently reset or replace the user's v5.5 session.
- This is scripted simulation. It does not connect to actual telephone calls, email, live chat, social networks, SMS, real customer queues, AI services or live multi-user employee accounts.
- This is a 2D playable workstation module. It is not yet embedded in the 3D office scene, GLB character flow or main game navigation.
- Shift scores are training/gameplay indicators. They do not automatically alter HR records or award a real promotion.

## Local checks

From this package folder, run the Node test files in `tests/`. They exercise the shift engine, briefing and break gates, scripted customer decision flow, Customer 360 write-through, compliance scoring, repeat-shift reset and page contract.
