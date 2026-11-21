# CALLORIA v6.97 — Case Recovery Action Planner

## Added

- A ranked next-action list immediately below the v6.96 owner-workload panel in CRM.
- Deadline buckets for overdue, due now, within 15 simulated minutes, within 60 simulated minutes and later work.
- Separate states for supervisor review, paused off-shift work and unavailable simulated clocks.
- Operational next-step guidance based on follow-up status, SLA risk, owner and claimant state.
- Existing CRM case-open actions on each visible action card.
- Responsive card layout for mobile screens.

## Safety

- Reads only `caseFollowUpMetrics(...).rows` already calculated by CRM.
- Keeps the existing case action system authoritative.
- Does not update state, local storage, Supabase, ownership, claim status, due dates, follow-up history or case outcomes.
- Escapes all dynamic text and case references before inserting them into HTML.
- Adds no dependency, database migration, endpoint, environment variable or network request.

## Carried forward

Includes the v6.96 workload plugin and its module/style dependencies so the post-transform chain can be installed as a cumulative overlay. Keep any already-installed v6.94/v6.95 case-lifecycle safety transforms registered; this package does not replace them.
