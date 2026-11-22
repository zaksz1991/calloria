# CALLORIA v7.27 — Coaching Sustainment Checkpoints

This additive release extends the digital follow-up supervisor workflow through v7.27.

After a supervisor records a completed coaching plan's outcome review, CALLORIA schedules a 7-day and a 30-day follow-through check. The Supervisor workspace shows upcoming, due, overdue and recorded checks. Supervisors can record each due checkpoint once, with a scorecard comparison and timeline event.

Checkpoint outcomes distinguish a a previously achieved target maintained, a target newly reached, further improvement, regression, stable performance below target and insufficient evidence. Response-rate checks require at least three new completed follow-ups; count-based workload checks require at least one. Missing or inadequate evidence is not converted into a zero.

## Release contents

- `js/` — v7.23–v7.27 digital follow-up engines.
- `build/` — ordered Vite transforms for v7.23–v7.27.
- `styles/` — responsive supervisor, performance, coaching, outcome and checkpoint panels.
- `tests/` — unit, integration-transform and Vite registration tests.
- `docs/` — release notes and verification records.
- `vite.config.js` — configuration snapshot with v7.27 registered after v7.26.

## Deployment boundary

This is a cumulative v7.23–v7.27 overlay for the digital follow-up workflow, not a complete CALLORIA repository. It does not contain the full application source, the repository's `public/assets/` GLB models, `.git`, deployment credentials or environment files. Merge it into the existing `zaksz1991/calloria` checkout and preserve unrelated source and assets. Review the supplied Vite configuration against the actual repository before replacing it.

No production deployment is claimed by this ZIP. The automated release tests validate the supplied modules and source transforms only; the complete Vite build and live Vercel runtime must be checked in the real repository/deployment.
