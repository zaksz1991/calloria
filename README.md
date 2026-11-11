# CALLORIA v4.9 — Performance, Promotion & Career Progression

An additive employee performance and career progression workspace for the existing CALLORIA Vite application. This patch does not replace or modify `vite.config.js`, `main.js`, the agent desk, the OJT flow, workforce control, supervisor console, 3D assets or existing game systems.

## Included

- Employee scorecards with a weighted performance model.
- Monthly performance review entry and CSV export.
- KPI model: QA 25%, CSAT 20%, FCR 15%, schedule adherence 10%, productivity 10%, attendance 10%, compliance 10%.
- Promotion eligibility register and evidence-based eligibility reasons.
- Annual promotion examination with six weighted assessment domains.
- One exam attempt per calendar year and a maximum of three attempts per target level.
- Exam history, pass/fail outcome and automatic one-level career advancement after a pass.
- Six-level career framework from Customer Service Associate to Operations Manager.
- Department performance dashboard for General CX, Voice, Email, Social, IT, QA, Workforce, CRM, Training, Operations and Sales.
- Universal monthly customer-care duty across every department: at least 8 frontline hours and 20 customer contacts per reviewed month.
- Optional read-only import of saved v4.7 Supervisor QA evaluations from same-origin browser storage.
- Local browser persistence under `calloria.performance-career.v49`.

## Installation

Copy these four files from the package's `public/` folder into the existing CALLORIA repository's `public/` folder. Preserve all existing files:

- `performance-career.html`
- `performance-career.css`
- `performance-career.js`
- `performance-career-engine.js`

Do not replace Vite configuration or application entry points. With the existing Vite `publicDir: 'public'` configuration, the page is served at:

`https://calloria.vercel.app/performance-career.html`

The route exists only after these files have been added to the project and that project has been built and deployed.

## Using the workspace

1. Set the cycle date in the top bar.
2. Open **Staff scorecards** to inspect the monthly ledger or record a review.
3. Enter the seven weighted KPI percentages, mandatory training completion, customer-care hours and customer contacts.
4. Open **Promotion centre** to review the reasons each employee is eligible or blocked.
5. Select an eligible employee and record the six-domain promotion examination.
6. Use the department view to review customer-care duty compliance across specialist teams.
7. Export scorecards or exam history as CSV when required.

## Promotion policy implemented

Promotion entry requires an active employee, at least six months at the current level, a current-year review no older than two months, weighted KPI of at least 80%, QA of at least 85%, compliance of at least 90%, attendance of at least 95%, mandatory training completion of at least 90%, and the universal monthly frontline customer-care minimum of 8 hours plus 20 customer contacts.

The promotion exam pass mark is 75%. Only one attempt per calendar year is accepted. A maximum of three attempts is permitted for each target level. A successful exam advances the employee exactly one level and resets the tenure clock for the new level. Failed attempts remain in the employee's exam history.

These thresholds are explicit simulation policy defaults and can be revised as the operating model is calibrated.

## Supervisor QA evidence sync

The **Sync supervisor QA evidence** button reads the v4.7 localStorage record `calloria.supervisor-qa.v47` when both pages use the same browser origin. For each employee with saved evaluations in the selected cycle year, it averages the saved QA scores and updates the QA metric on that employee's latest cycle-year review. It does not write to or alter the v4.7 supervisor data.

This is a browser-local evidence bridge, not a live API integration. It will not retrieve evidence from another browser, device, account or deployment origin. If v4.7 records are absent or use an unsupported version, the sync reports that no compatible source was found.

## Data and integration boundaries

All staff, monthly review and exam records in this release are synthetic demonstration data and are stored in the current browser's localStorage. The app does not connect to production HR records, payroll, authenticated employee accounts, telephony, CRM, ACD, real customer contacts or an external learning platform. Attendance, schedule adherence, productivity and customer-care hours/contacts are entered as review evidence; they are not automatically pulled from v4.8 Workforce Control. Do not treat demonstration scores or seeded exam histories as real employee performance records.

The workspace is standalone and is not yet part of CALLORIA's central navigation or a multi-user central database.

## Files

- `public/performance-career.html`
- `public/performance-career.css`
- `public/performance-career.js`
- `public/performance-career-engine.js`
- `tests/performance-career-v49.test.mjs`
- `CHANGELOG.md`
- `VERIFICATION.md`
