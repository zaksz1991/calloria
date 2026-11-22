# CALLORIA v7.26 — Digital Follow-up Coaching Outcome Reviews

This cumulative overlay extends the digital follow-up workflow through v7.26.

## What's included

- v7.23: supervisor alerts for overdue and at-risk digital follow-ups, with guarded supervisor escalation.
- v7.24: agent-level follow-up response scorecards and channel breakdowns.
- v7.25: evidence-led coaching recommendations and supervisor-owned coaching plans.
- v7.26: post-coaching outcome reviews against each plan's baseline and target.

## v7.26 workflow

After a supervisor marks a coaching plan completed, the plan appears in **Coaching outcome reviews**. The panel compares the current scorecard with the recorded baseline and target for that same agent. It shows whether the measure achieved the target, improved without reaching it, did not improve, or lacks sufficient evidence. A response-rate review requires at least three completed follow-up cycles.

The supervisor explicitly records the outcome review. The application stores a single evidence snapshot on the completed plan and logs an operation-timeline event. The review uses the retained scorecard at review time; it does not isolate only post-coaching contacts or establish causation. It is not an automated employee-performance sanction.

## Files

- `js/digital-followup-supervisor-engine-v723.js`
- `js/digital-followup-performance-engine-v724.js`
- `js/digital-followup-coaching-engine-v725.js`
- `js/digital-followup-coaching-outcomes-engine-v726.js`
- `build/calloria-digital-followup-supervisor-v723.mjs`
- `build/calloria-digital-followup-performance-v724.mjs`
- `build/calloria-digital-followup-coaching-v725.mjs`
- `build/calloria-digital-followup-coaching-outcomes-v726.mjs`
- Corresponding styles, regression tests, release notes and Vite config snapshot.

## Configuration

No database migration, external integration, dependency, credential or environment variable is required.

## Validation boundary

The included overlay tests pass 50/50 and the source/transform syntax checks pass. The full CALLORIA repository was not present in this preparation workspace, so no complete Vite build or live Vercel deployment is claimed. See `docs/RELEASE-STATUS-v7.26.txt`.
