# CALLORIA v7.27 — Digital Follow-up Coaching Sustainment Checkpoints

## Release purpose

v7.27 extends the v7.26 coaching outcome review with scheduled follow-through checks. An outcome review is no longer the final observation: the Supervisor workspace now schedules a 7-day and a 30-day checkpoint from the original review timestamp.

## Added

- Automatic 7-day and 30-day checkpoint scheduling after a new coaching outcome review.
- A legacy-plan action to schedule checkpoints for v7.26 outcome-reviewed plans that predate this release.
- A Supervisor checkpoint panel with due, overdue, recorded and upcoming counts.
- Due-date gating: a checkpoint cannot be recorded before its scheduled date.
- Per-checkpoint comparison against the scorecard captured at the original outcome review.
- Result classifications: previously achieved target maintained, target newly reached, further improvement, regression, stable performance and insufficient data.
- Immutable checkpoint recording with supervisor attribution and operation-timeline events.
- Duplicate and early-record protection.
- Evidence thresholds: at least one new completed follow-up for count-based metrics and three for response-target-rate metrics.
- Responsive mobile layouts for checkpoint metrics, rows and actions.

## Preserved

- v7.23 supervisor monitoring and controlled intervention.
- v7.24 agent-level follow-up performance scorecards.
- v7.25 coaching recommendations, plans and plan status transitions.
- v7.26 coaching outcome reviews.
- Existing 3D workplace, recruitment, onboarding, multichannel operations, GLB assets, Supabase configuration and Vercel configuration.

## Data and decision boundaries

- Checkpoints use the existing local/synthetic digital follow-up scorecard and coaching-plan state.
- No SQL migration, Edge Function, secret, API key, environment variable, package dependency or external provider is added.
- The scorecard is cumulative. Checkpoint comparisons are operational snapshots; they are not causal studies and do not prove coaching caused a change.
- Insufficient new workload is recorded as insufficient evidence, not as a zero-value success or failure.
- Coaching results do not automatically trigger disciplinary, compensation or employment decisions.
