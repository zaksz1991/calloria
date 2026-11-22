# CALLORIA v7.30 — Workforce Intelligence Command Centre

A cumulative v7.23–v7.30 source overlay for the existing CALLORIA Supervisor workspace. It extends the v7.29 Workforce Performance Intelligence panel with operational workstream comparisons, explicit department scorecards, a risk-prioritised supervisor queue, capacity stress scenarios and CSV export.

## Included features

### Operational workstreams

Voice is scoped to the current local employee profile. Email, Live Chat and Social use the retained attributed per-agent response-cycle data. Agent-level totals with missing channel metadata are shown in a separate `Channel not recorded` row, preventing unexplained loss from the backlog calculation.

### Department comparisons

Department performance is grouped only when a digital agent has an explicit `departmentName`, `department`, `teamName`, `team` or department ID, or when an exact agent ID matches a row in `state.workforceRoster`, `state.staff` or `state.employees`. `state.departments` can map department IDs to display names. The current local employee can also map through the existing exact `EMP-<nameInitials>` identifier and `state.department` value.

Where that data does not exist, the dashboard displays a clear unavailable state instead of inventing department membership.

### Supervisor attention queue

Flags attributed agents with overdue work, at-risk work or response-target rates below 80%. The queue gives a suggested supervisor focus based on the recorded signal. It does not perform reassignment or disciplinary actions.

### Capacity scenario planner

The planner stress-tests current open digital backlog at 80%, 100% and 130% of current load. Enter:
- planned available seats;
- maximum open items per seat, an editable planning assumption.

The dashboard calculates modelled seats required and the gap to the entered staffing plan. This is not a time-series forecast because the retained source does not provide a validated organisation-wide arrival rate, active-seat feed or occupancy history.

### Reporting

The CSV export contains operational workstream summaries, mapped department summaries and flagged digital-agent rows. CSV cells are quoted and formula-leading values are neutralised.

## Important boundaries

This is a read-only local-simulation command centre, not verified organisation-wide workforce reporting. Voice remains scoped to the current employee profile. Digital metrics are based on retained simulated response cycles. Department comparisons require explicit mapping. Missing source evidence remains unavailable. No staffing, rota, case assignment, employee, compensation or career data is changed.

No Supabase migration, Edge Function deployment, secret, environment variable or npm dependency is required.

## Package contents

- `js/workforce-command-centre-engine-v730.js`
- `build/calloria-workforce-command-centre-v730.mjs`
- `styles/calloria-workforce-command-centre-v730.css`
- `tests/workforce-command-centre-v730.test.mjs`
- `tests/vite-config-v730.test.mjs`
- Updated `vite.config.js`
- v7.23–v7.29 overlay source, tests and release documentation carried forward from the previous cumulative package.

The ZIP is not the full CALLORIA repository. It does not include the private `.git` directory, all original application source, local environment files, or `public/assets/` GLB binaries. Preserve those from the existing checkout.

## Validation

See `docs/TEST-RESULTS-v7.30.txt` and `docs/TEST-EXECUTION-v7.30.txt`. Tests and syntax checks passed in the preparation workspace. A complete Vite production build and live deployment were not performed.

## Installation

Follow `INSTALL-GITHUB-v7.30.md`. The public repository's latest readable Vite configuration during this release check contains registrations through v7.27 but not v7.28/v7.29. Do not install only the v7.30 plugin over that older state. Merge the complete cumulative overlay and verify the ordered v7.23–v7.30 plugin chain before pushing.
