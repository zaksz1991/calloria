# CALLORIA v6.96 — Case Follow-up Workload Intelligence

## Added

- Read-only CRM panel grouping active reopened-case follow-ups by recorded owner.
- Per-owner counts for open, urgent, overdue, due-soon, in-progress and supervisor-review work.
- Earliest outstanding simulated due time per owner.
- Recorded claimant visibility for active/in-progress follow-ups.
- Ownership integrity checks for unassigned follow-ups, in-progress records without a claimant, and open records that retain a stale claimant.
- Exposure labels to prioritise queue visibility. These are operational warning labels, not staffing-capacity calculations or employee performance ratings.
- Mobile-friendly horizontal table scrolling and compact responsive summary cards.

## Safety and data boundaries

- Reads the existing `caseFollowUpMetrics(...).rows` output.
- Does not change case status, owner, claimant, due time, follow-up history or save data.
- Does not automatically assign, reassign, claim, close or escalate work.
- Escapes all dynamic owner, claimant and case-reference text before rendering.
- Adds no Supabase migration, API call, environment variable or npm dependency.

## Not changed

- Existing case reopen / claim / resolve / supervisor-review workflows.
- v6.94 customer-confirmation closure guard and v6.95 SLA correction; preserve those plugins if already installed.
- Any 3D models, GLB assets, `index.html`, or existing save-schema fields.
