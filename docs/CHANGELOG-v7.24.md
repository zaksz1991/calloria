# CALLORIA v7.24 — Digital Follow-up Performance Scorecards

## Added

- Supervisor performance panel groups follow-up response cycles by agent.
- Completed follow-ups are attributed to the `agentId` stored on the responding agent message.
- Open follow-ups are attributed to the contact's current `assignedTo` owner.
- Scorecards show completed cycles, target-met rate, late replies, open follow-ups, at-risk/overdue work and average response time.
- Overall and per-channel email, live-chat and social metrics are shown independently.
- Mobile layout collapses the scorecards into one column without a forced wide table.

## Measurement rules

- Measures second-and-later customer response cycles only; first-response SLA remains separate.
- Target-met rate is calculated only from completed follow-up cycles. Open cycles do not inflate the denominator.
- A late completed response is separate from an unanswered overdue follow-up.
- Completed cycles use the actual responding message's agent ID. Open work uses the current assigned owner; the feature does not invent past assignment history.
- The scorecard uses retained local synthetic game history. It is not a live provider report or a real-world staff-performance record.

## Compatibility and controls

- Runs after v7.23 Digital Follow-up SLA Supervision and the preceding v7.22 suite.
- Preserves first-response SLA, digital queue lifecycle, message history, supervisor escalation requests and current GLB/runtime plugins.
- No Supabase migration, Edge Function, secret, environment variable, npm dependency or GLB asset is added.
- V7.24 is a read-only analytics panel; it does not reassign work, change scorecards or issue staff warnings.
