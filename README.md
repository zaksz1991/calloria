# CALLORIA v6.97 — Case Recovery Action Planner

This is a cumulative overlay on top of the v6.96 CRM follow-up workload panel. It adds a ranked, read-only action list for active reopened cases.

## Production files

- `build/calloria-case-followup-workload-intelligence-v6-96.mjs` (v6.96 dependency)
- `build/calloria-case-recovery-planner-v6-97.mjs` (new v6.97 post-transform)
- `js/case-followup-workload-engine-v696.js` (v6.96 dependency)
- `js/case-followup-workload-v696.css` (v6.96 dependency)
- `js/case-recovery-planner-engine-v697.js` (new read-only planner)
- `js/case-recovery-planner-v697.css` (new responsive styles)

## Behaviour

- Ranks supervisor decisions, overdue cases, due-now and near-deadline work before lower-risk items.
- Highlights missing owners and inconsistent claimant metadata.
- Separates live-clock deadlines from paused-off-shift and unavailable-clock records.
- Shows the recommended next operational step for each high-priority case.
- Uses the existing `open-case-followup` action to open the case in the current CRM workspace.
- Limits the visible action list to eight cards while reporting the number of additional active items.

This is advisory and read-only. It does not claim, reassign, close, resolve, reschedule or modify case records. Existing CRM actions and case-lifecycle rules remain authoritative.

## Verification boundary

The included tests run against the engine, Vite transform and a representative fixture based on the public `c8a48d6` source anchors. They do not constitute a full application build or production deployment test. See `VERIFICATION-v6.97.md`.
