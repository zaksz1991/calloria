# CALLORIA v6.3 — Office Routine Gameplay

## Purpose

v6.3 turns the 3D workplace into part of the actual shift loop. The player now moves between staff areas and the assigned workstation instead of treating the office as a visual entrance to a separate 2D game.

This is still the CALLORIA contact-centre career simulator. It does not add a bank workflow, bank statement or finance subsystem.

## New 3D staff areas

- **Staff Reception:** enter employee name, select the assigned team and clock in. A new customer shift cannot start without the matching reception check-in.
- **Team Briefing Room:** record attendance when the 7:30 AM or 2:00 PM briefing becomes due. Return to the Live Floor to complete the corresponding scheduled event.
- **Staff Lounge:** record the scheduled 10:30 AM morning break or 12:30 PM lunch break when it becomes due. Return to the Live Floor to complete that event.
- **Supervisor Hub:** log a request for customer escalation, policy/knowledge guidance, a system issue, customer safety support or workload assistance.
- **Reception GLBs:** when the files exist at the tested paths, the reception desk and receptionist models are loaded from the existing local model directory. Missing models are reported; no primitive human substitute is created.

## How the gameplay loop works

1. Open the 3D workplace at `/office-floor.html`.
2. Walk to **Staff Reception**. Press `E` or `USE`, enter the employee name and choose the assigned team, then clock in.
3. Walk to the workstation for that exact team. The desk and computer GLBs must load before the workstation can be entered.
4. Start the customer shift in the Live Floor. The existing synthetic customer queue and conversation simulation remain unchanged.
5. When a briefing or break becomes due, the Live Floor directs the player back to the 3D Workplace.
6. Walk to the Team Briefing Room or Staff Lounge and record attendance. Return to the Live Floor and complete the scheduled event there. The event cannot be cleared without the matching physical-area attendance record.
7. Finish the shift in the Live Floor. Return to Staff Reception and clock out.
8. During a shift, the Supervisor Hub can store a local support request. It does not send a live alert to another person.

The default shift schedule remains: 7:30 AM morning briefing, 10:30 AM morning break, 12:30 PM lunch and 2:00 PM afternoon briefing. The simulation advances its shift clock when the scheduled events are completed; it is not a real-time 15- or 30-minute timer.

## Installation

This is an overlay for the existing CALLORIA v6.2/v6.1 project. Copy the files from this package's `public/` folder into the repository's existing `public/` folder, replacing matching versions:

- `office-floor.html`
- `office-floor.css`
- `office-floor.js`
- `office-floor-engine.js`
- `office-routine-engine.js` **(new)**
- `live-floor.html`
- `live-floor.css`
- `live-floor.js`

Keep these v6.1 dependencies in `public/`:

- `agent-workbench-engine.js`
- `customer-journey-engine.js`
- `live-floor-engine.js`
- `career-progression-engine.js`

Keep the entire existing `public/assets/models/` directory. Do not replace or delete the GLB models.

No Vite config, `package.json`, Supabase or Groq setting changes are required. The new browser files are served from the existing Vite `public/` directory.

## Routes

- 3D workplace: `https://calloria.vercel.app/office-floor.html`
- Customer shift: `https://calloria.vercel.app/live-floor.html`

These routes reflect the new code only after the updated files have been copied into the repository and the deployment succeeds.

## GLB usage

The workplace keeps using the desk, computer, agent and supervisor GLB paths from v6.2. v6.3 adds optional roles for:

- `office/reception/reception-desk/`
- `receptionists/lady_in_a_trenchcoat/`

The in-page GLB Asset Check reports the actual file loaded or the candidate paths that failed. The package workspace does not contain the user's full model directory, so this release cannot certify which of those paths will resolve in the deployed repository.

## Data and integration limits

- Staff attendance, routine events and supervisor support requests are stored in browser `localStorage` on the same origin.
- The records are not shared across devices, employees or browser profiles and are not written to Supabase.
- Supervisor Hub requests remain local records, not real-time notifications or v4.7 supervisor-console tickets.
- The game does not use biometric attendance or real employee data.
- Existing customer interactions remain scripted simulations, not live telephone, email, social, SMS or chat connections.
- The 3D renderer still depends on the pinned Three.js 0.170.0 CDN modules. GLB assets are loaded from local project paths.

## Verification

See `VERIFICATION.md` and `TEST_RESULTS.txt` for the focused checks run for this overlay. A complete repository build, Vercel deployment and test against the user's actual GLB model tree were not performed in this workspace.
