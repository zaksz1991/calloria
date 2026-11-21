# CALLORIA v6.90 — Live Shift Command Centre

## New functionality

- Adds a compact Shift Control launcher during an active employee shift.
- Provides a live, read-only priority board derived from the employee's existing saved state.
- Prioritises active calls and after-contact work before new contacts.
- Lists queued inbound voice contacts with critical/high/normal/low priority and wait age.
- Uses the simulator's digital first-response SLA policy to surface queued and currently assigned digital work that is at risk or overdue.
- Surfaces due customer callbacks, including outbound callbacks.
- Surfaces open or overdue reopened-case follow-ups using the simulator day and clock.
- Surfaces open supervisor requests.
- Provides direct navigation to the existing Inbound, Queue, Outbound, Digital, Cases and Supervisor views.
- Refreshes after the application's saved state changes and when returning to the browser tab. The open panel also refreshes its countdowns periodically.
- Uses a responsive mobile drawer with safe-area insets, keyboard dismissal, focus visibility and reduced-motion support.

## Data and safety boundaries

- Read-only: no application state is mutated by the command-centre engine.
- No new local-storage schema or save key is introduced.
- No new package dependency, API request, Supabase migration, Edge Function, environment variable or secret is added.
- No real calls, inboxes, social accounts or CRM systems are contacted. All listed work is existing simulated gameplay data.
- Digital first-response timing follows the public v6.63 engine's 75% at-risk threshold, per-contact SLA target and breached-state rules. The board is not a contractual SLA report.
- The panel shows queued digital items and active/awaiting-customer digital items assigned to the current employee; it does not list another employee's active digital conversations.
- An outstanding item is a navigation aid. Its appearance does not accept, close, transfer, complete or reassign that item.

## Package contents

- `index.html` — cumulative root shell based on the current public `main` shell inspected on 21 November 2026. Loads v6.89 shift close-out and v6.90 command-centre assets before `js/main.js`.
- `js/calloria-shift-command-centre-v6-90.mjs` — pure priority engine and read-only browser runtime.
- `calloria-shift-command-centre-v6-90.css` — responsive launcher and drawer.
- `tests/calloria-shift-command-centre-v6-90.test.mjs` — 11 focused regression tests.
- v6.89 shift-report files and tests are retained in this cumulative overlay.
