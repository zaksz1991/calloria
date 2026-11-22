# CALLORIA v7.30 — Workforce Intelligence Command Centre

## Purpose

Adds a consolidated, read-only Supervisor command centre above the v7.29 Workforce Performance Intelligence panel. It turns retained evidence into operational comparisons, a risk-prioritised supervisor attention list and a transparent staffing what-if planner.

## What changed

- **Operational workstream comparison:** Voice for the current local employee profile and separately attributed Email, Live Chat and Social digital follow-up metrics.
- **Department comparison:** digital performance grouped only when an agent record contains an explicit department/team field or an exact employee-ID match exists in `state.workforceRoster`, `state.staff`, `state.employees`, or the current employee's explicit `state.department` plus `EMP-${state.nameInitials}` identifier.
- **Supervisor attention queue:** ranks identified digital agents with overdue work, at-risk work or response-target rates below 80%, and provides an evidence-linked next focus.
- **Capacity scenario planner:** stress-tests the current open digital backlog at 80%, 100% and 130% of the current load. Supervisors can enter planned available seats and a configurable maximum open-items-per-seat assumption to calculate modelled seat gaps.
- **Career evidence strip:** surfaces existing career review packet, development and sustainment counts without changing career decisions.
- **CSV export:** downloads current workstream, mapped department and flagged agent summary rows.
- **Responsive layout:** dashboard cards stack at tablet/mobile widths; wide scorecards scroll inside their own table containers.

## Data and decision boundaries

- The command centre is read-only. It does not allocate or reassign contacts, set rotas, change staffing, alter employee records, or make hiring, promotion, pay, disciplinary or termination decisions.
- Department rows require explicit department data or exact employee-ID roster matching. Unmapped agents are not assigned to a department by name, channel or guesswork.
- Voice figures still represent the current local employee profile only. They are not company-wide voice aggregates.
- Digital channel figures come from retained per-agent response cycles. They are not live provider queue depth, active logins or verified contact-centre ACD totals.
- When channel breakdown data is missing, agent-level completed/open totals are retained in a separate **Channel not recorded** row instead of disappearing from the total backlog.
- The capacity planner is a backlog stress test, not an arrival-rate forecast, occupancy model, rota optimiser or instruction to hire. Its multipliers and per-seat workload are editable planning assumptions.
- Missing data remains unavailable; it is not converted to zero or estimated from another employee.

## Configuration

- No database migration.
- No Supabase Edge Function change.
- No new environment variable or secret.
- No new npm dependency.
- No change to GLB assets or 3D workplace runtime.

## Validation

- 107 automated tests passed; 0 failed.
- 34 JavaScript/MJS files passed Node syntax checks.
- Generated v7.23 → v7.30 transform chain passed syntax validation.
- Vite registration order, safe source-drift behaviour, transform idempotency, session-only scenario inputs and CSV export contracts are covered.
- Full Vite production build, production browser session, GitHub push, Vercel deployment and physical mobile-device verification were not run in this preparation workspace.
