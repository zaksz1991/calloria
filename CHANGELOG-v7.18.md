# Changelog — v7.18

## Digital SLA triage and anti-starvation ordering

- Replaces priority-only ordering in the digital quick queue and full waiting queue with SLA-first triage.
- Places first-response breaches ahead of at-risk work, and at-risk work ahead of on-track work.
- Adds a bounded age boost: +1 priority point per 15 simulated minutes, capped at +3.
- Keeps SLA urgency ahead of ageing so stale on-track work cannot outrank a breached contact.
- Adds a reason badge to each queue row: breached, due soon, ageing queue, on track or unavailable SLA time.
- Uses the existing queue sorter and SLA assessor injected from `main.js`; no competing timing policy is introduced.
- Adds deterministic tie-breaking and preserves the existing channel filter.
- Adds safe source-anchor checks, no-partial-transform behaviour and transform idempotency.

## Unchanged

- Accept/claim behaviour and workload capacity checks.
- Existing channel-specific SLA targets and simulated clock.
- Contact records, first-response timestamps, local/cloud save structure and Supabase.
- Existing voice, outbound, handover and supervisor workflows.
