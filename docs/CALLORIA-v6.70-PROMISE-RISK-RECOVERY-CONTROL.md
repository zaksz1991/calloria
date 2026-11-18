# CALLORIA v6.70 — Supervisor Promise Risk & Recovery Control

## Purpose

The v6.69 Promises view is an employee worklist. v6.70 adds a management portfolio so supervisors can review open customer commitments across the locally recorded employee owners, identify due-time risk, and document an intervention without falsely closing the callback itself.

## Portfolio behaviour

- Critical: a promise is more than 30 simulated minutes overdue or already requires independent review.
- Due now: the simulated callback due time has arrived, but the item is not in the critical category.
- At risk: the promise is due within 30 simulated minutes, including the existing 15-minute due-soon window.
- Watch: due within the following 30-minute window.
- Normal: scheduled outside the watch window.
- The portfolio shows any active linked callback task and flags due/overdue/review promises without an active callback task.
- Owner summaries show how the outstanding commitment exposure is distributed in the local save.

## Escalation workflow

1. Open Management → Promise control.
2. Select an at-risk, due, overdue or independent-review promise and raise an escalation with a reason of at least 20 characters. Duplicate open escalation requests for the same promise are blocked.
3. A supervisor records their name and a recovery action of at least 20 characters. The reviewer cannot be the original promise owner.
4. The supervisor request is marked reviewed and the action is retained in the request and commitment activity history.
5. The underlying callback commitment remains open. The owner must still complete the actual callback and after-contact outcome, or use the existing independent-review process after the two-attempt limit.

## Data and integration

- New engine: `public/promise-control-engine.js` (UMD; loaded before `js/main.js`).
- The dashboard reads `customerCommitments`, `callbacks` and `supervisorRequests` from the existing profile state.
- The existing customer commitment engine remains authoritative for due-time classification. v6.70 adds risk grouping and escalation controls only.
- All timestamps remain in the accelerated simulation calendar.

## Boundaries

This is a local single-player simulation. It is not a real multi-agent supervisor feed, does not send customer notifications, and does not create provider-side tasks. No database migration, new secret, environment variable or dependency is required.
