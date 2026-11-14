# CALLORIA v6.54 — Support Case Ownership and Routing

This cumulative overlay adds an actionable ownership workflow to the RuffNeck support-ticket queue.

## What is added

- Explicit ownership metadata for each support case: assignee type, owner, specialist team, assignment time and assigning agent.
- Specialist routing for RuffNeck LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke.
- A Workforce ownership queue with filters for all active cases, cases owned by the player, unassigned cases, specialist queue and supervisor queue.
- **Claim for me**, **Route to specialist**, **Supervisor review** and **Release** actions.
- Supervisor routing marks the case Escalated and mirrors the owner/status into the existing CRM case record.
- A bounded assignment audit trail records who changed ownership, the previous owner and the new owner.
- Existing SLA due times are preserved during reassignment.
- One-time migration of existing support records into the ownership model.
- Responsive layout for smaller screens.

## Simulation boundary

All assignments are local simulation records. Specialist and supervisor queues are role queues, not live employee accounts. No real RuffNeck platform, external ticketing service or Supabase table is contacted by this feature.

## Included files

This is a cumulative build-plugin overlay containing integrations v6.42–v6.54, the related tests and a replacement root `vite.config.js`. It does not include the full CALLORIA application repository or the project's existing GLB assets.
