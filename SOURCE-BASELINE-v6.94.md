# CALLORIA v6.94 source baseline

Audited against the public `main` branch on 21 November 2026.

## Target

`js/case-lifecycle-engine.js`

## Exact logic audited

- `completeCaseFollowUp()` validates outcome and 30-character evidence, then increments `followUp.attempts`, writes `lastOutcome` and `lastSummary`, and only afterwards checks `input.customerConfirmed` inside the `resolved` branch.
- `reviewCaseFollowUp()` validates reviewer independence, decision and 30-character evidence, then writes `reviewedBy`, `reviewedAt` and `reviewNotes`, and only afterwards checks `input.customerConfirmed` inside the `close_after_review` branch.

## Related caller behaviour

`js/main.js` catches these errors and does not immediately call `saveState()` in the catch path. However, the lifecycle functions receive the case object held inside `state.cases`; any mutation made before throwing remains in memory and may be persisted by a later successful action. v6.94 prevents the partial writes at their source.

## Transform strategy

No whole-file replacement. The Vite plugin rewrites four unique source anchors in the existing engine: two early preflight insertions and removal of the two later duplicate checks. It adds a marker and is idempotent. If any anchor count is not exactly one, the transform aborts before returning modified code.

## Known limitation

This source audit is for current public `main`, not a byte-for-byte checkout of the Vercel deployment commit in the user's earlier logs. Build-time integration must be checked on the user's pushed branch.
