# CALLORIA v5.0 — People Operations

An additive browser-based People Operations workspace for the CALLORIA simulation. It extends the v4.7–v4.9 operations modules without replacing existing project files or modifying `main.js`, `vite.config.js`, the recruitment flow, OJT, 3D assets or game systems.

## Included modules

- Employee register with staff ID, work email, department, job title, supervisor, hire date, contract type, work pattern and employment status.
- Configurable sample leave entitlements per employee.
- Leave request workflow with weekday calculation, overlapping-date checks, pending balance reservations, approval/rejection and CSV export.
- Daily attendance register with one status per employee per date; lateness and early departure minutes are recorded without automatic payroll deductions.
- Probation decision workflow: confirm, extend with a future review date, or refer for an exit process. Evidence notes are required.
- Employee relations case register for coaching, recognition, grievances, conduct review, attendance review and workplace concerns. Closing a case requires a recorded outcome.
- Internal transfer proposal and approval. A future-dated approved transfer is applied only when the workspace date reaches its effective date; stale transfers are placed on hold.
- Controlled offboarding with equipment, access-removal request, handover, payroll hand-off and exit interview controls. The employee is not marked Exited until every checklist item is complete and the recorded last working date has arrived.
- Overview dashboard, attention queue, activity history and CSV exports.
- Explicit one-way import of employee identity/department/level/supervisor/status snapshots from Performance & Career v4.9 when both pages run on the same browser origin.
- Links to the previous Performance & Career, Workforce Control and Supervisor QA pages.

## Installation

This is an additive overlay, not a full repository snapshot.

1. Extract the ZIP.
2. Open the `CALLORIA_v5_0_People_Operations/public` folder.
3. Copy these four files into the existing CALLORIA repository `public` folder:
   - `people-operations.html`
   - `people-operations.css`
   - `people-operations.js`
   - `people-operations-engine.js`
4. Keep all existing project files. Do not replace the existing Vite configuration or application entry points.
5. Deploy using the repository's normal process.

The page route is `/people-operations.html` and the live route after deployment is expected to be `https://calloria.vercel.app/people-operations.html`.

## v4.9 staff snapshot import

Open Performance & Career v4.9 first in the same browser and origin so its `calloria.performance-career.v49` local-storage record exists. Then open People Operations and use **Import v4.9 staff snapshot**. The import updates this module's employee snapshot and adds missing staff records. It does not write back to v4.9, copy monthly KPIs, or synchronize automatically. Repeat the import deliberately when a refresh is needed.

## Data and operational boundaries

- Demonstration data is synthetic. A small sample employee population is preloaded.
- All records are stored in the current browser's `localStorage`. They are not shared between staff, browsers or devices and can be cleared by browser storage cleanup.
- This is not an authenticated HR information system. It has no tenant isolation, user roles, manager permissions, server-side audit trail, encryption-at-rest guarantees, backup, or central multi-user database.
- Do not enter real employee personal data, grievance evidence, medical details or other confidential HR information into this demonstration build.
- Leave entitlement values are editable examples, not a statement of CALLORIA employment policy or Nigerian statutory entitlements. Weekday calculation excludes Saturday and Sunday but does not apply public holidays, shift calendars, accrual or carry-over rules.
- Attendance is manually recorded. There is no biometric/time-clock feed, automatic schedule reconciliation or payroll deduction.
- The payroll checklist item is a notification/handoff marker only. There is no salary calculation, payment, benefits or final settlement function.
- Probation confirmation and exit routing are workflow records, not legal advice or automated employment decisions. Human review is required.
- Employee-case records are neutral administrative records, not findings of misconduct.
- CSV export is a manual download and does not create a secure archive.

## Files

- `public/people-operations.html` — workspace interface.
- `public/people-operations.css` — responsive styling.
- `public/people-operations.js` — UI rendering and browser events.
- `public/people-operations-engine.js` — validation, workflows and local persistence.
- `tests/people-operations-v50.test.mjs` — focused unit and integration-contract tests.
- `CHANGELOG.md` — release notes.
- `VERIFICATION.md` — exact verification scope.
