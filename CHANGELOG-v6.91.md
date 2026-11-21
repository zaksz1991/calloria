# CALLORIA v6.91 — Shift Rhythm & Adherence Monitor

## Upgrade

Extends the existing Shift Control drawer with a live read-only shift schedule panel. It shows current agent state, next scheduled break, shift end, active interaction load, schedule adherence, completed/upcoming breaks and deviations.

## Behaviour

- Reads `shiftRecord.plan`, `shiftRecord.events`, `shiftElapsedMinutes`, `agentStatus`, active inbound/outbound work, wrap-up and active digital IDs from the existing guest/employee save.
- Mirrors the public `shift-engine.js` adherence rule: available/busy/wrap-up count as working time; `break` counts during scheduled breaks.
- Uses the employee's persisted shift plan, falling back to the existing 08:00–17:00 plan only when the plan is absent. Custom plans are respected.
- Warns when a scheduled break window is open but active customer work remains. It does not interrupt, close, accept, transfer or complete contacts.
- Shows the existing break schedule but does not create new breaks, change state, edit shift records or award adherence.
- No save-schema change, database migration, API, Edge Function, package dependency or environment variable.

## Files

- Replaces `js/calloria-shift-command-centre-v6-90.mjs` in place, retaining its URL referenced by the current `index.html`.
- Extends `calloria-shift-command-centre-v6-90.css` in place, retaining the current stylesheet link.
- Adds focused tests under `tests/`.
- Retains the v6.89 shift-review and v6.90 command-centre cumulative support files.
