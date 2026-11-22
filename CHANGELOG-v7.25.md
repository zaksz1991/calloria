# CALLORIA v7.25 — Digital Follow-up Coaching Plans

## What changed

- Converts v7.24 agent follow-up scorecards into supervisor-reviewed coaching recommendations.
- Prioritises open overdue follow-ups, clusters of at-risk work, and sustained low response-target achievement.
- Uses one strongest coaching focus per agent to avoid overwhelming the supervisor with multiple simultaneous plans.
- Requires at least three completed follow-up cycles before making a response-rate recommendation.
- Shows the evidence behind each recommendation and a measurable practice objective.
- Allows a supervisor to create, start and complete a coaching plan.
- Suppresses repeat recommendations while an agent has an open or in-progress plan.
- Records plan creation and lifecycle changes in the existing local operations event timeline.
- Keeps the workflow responsive on phone and desktop layouts.

## Behaviour and boundaries

- Synthetic local simulation records only. No external provider, customer inbox, AI service or Supabase table is called.
- The existing v7.23 supervisor SLA watch and v7.24 performance scorecards remain in place.
- Coaching is a support and practice workflow. It does not automatically discipline staff, change employment status, change promotion eligibility or modify KPI outcomes.
- No migration, secret, environment variable, external service, package dependency, or binary/GLB asset is added.
- State is attached to the existing game state and persisted through the existing `saveState()` flow.

## Validation

The focused Node tests cover recommendation priority, sample-size gating, duplicate suppression, plan creation, immutable lifecycle transitions, plugin idempotence, safe transform skipping and Vite registration order. A full application build, full repository test suite, live Vercel deployment and actual device visual checks are not claimed by this package.
