# CALLORIA v6.71 — Case Reopen & Follow-up Control

## Product change

v6.71 extends the existing CRM case record into a controlled post-resolution workflow. Customers can return after a case was marked resolved and challenge the outcome. The simulator records why the case was reopened, who owns the next action, the simulated due time, the action history and the final evidence.

This is a continuation of contact-centre operations gameplay. It is not a recruitment quiz or a disconnected practice exercise.

## Agent workflow

1. Open **CRM & cases** during an active shift.
2. Expand a case whose status is resolved or completed.
3. Choose a reopening reason: customer says unresolved, incorrect resolution, new information, repeat contact or service failure.
4. Select urgent (30 simulated minutes) or normal (120 simulated minutes), then write at least 20 characters explaining why the customer has returned.
5. Reopen the case. It appears in the CRM follow-up worklist with an owner, priority, due time and risk state.
6. Claim the follow-up before recording work. A different employee cannot complete a follow-up already claimed by another employee.
7. Record one of three outcomes:
   - **Resolved:** requires at least 30 characters of factual evidence and explicit confirmation that the customer confirmed resolution.
   - **Pending customer:** keeps the case open and reschedules the follow-up for the next simulated day.
   - **Escalated:** routes a case-specific request to the supervisor desk and prevents agent self-closure.

## Supervisor workflow

1. Open the Supervisor desk and select the case follow-up request.
2. Review the linked CRM case, reopening reason and agent evidence.
3. Choose to return the case to the agent or close after independent review.
4. The reviewer must be different from the original case owner. Closing after review still requires explicit customer confirmation and at least 30 characters of review evidence.

## Due-time and status rules

- Urgent follow-up target: 30 simulated minutes.
- Normal follow-up target: 120 simulated minutes.
- A follow-up is marked due soon in its final 15 simulated minutes and overdue after its target.
- Due-time progression uses CALLORIA's accelerated shift clock. The follow-up timer pauses while the agent is off shift.
- A reopened case is not marked resolved merely because an employee typed a note. The explicit customer-confirmation requirement is enforced by the engine.
- Reopening is bounded to five cycles per case. Cases beyond the limit need a management decision rather than another automatic reopen.

## Files changed

- `js/case-lifecycle-engine.js` — new lifecycle engine.
- `js/main.js` — CRM follow-up worklist, agent claim/complete actions, supervisor routing and local-save migration.
- `styles.css` — responsive case follow-up panels, forms and worklist rows.
- `package.json` — syntax check includes the new engine; existing dependencies are unchanged.
- `CHANGELOG.md` — v6.71 release record.
- `tests/case-lifecycle-engine-v671.test.mjs` — engine regression tests.
- `tests/case-lifecycle-ui-v671.test.mjs` — application/UI contract tests.

## Data and safety boundaries

- Case records, customers, names, interactions and timestamps are synthetic local simulation data. The feature does not connect to an external CRM, ticketing platform, phone system or customer database.
- No Supabase migration, new secret, environment variable or package dependency is required.
- Existing case notes and transcript fields remain untouched. The new lifecycle metadata is added to each case in the existing local profile save.
- Reopen reasons and follow-up evidence are displayed as part of the local case record. Do not enter real customer financial credentials, PINs, passwords or one-time codes.
