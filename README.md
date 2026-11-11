# CALLORIA v4.8 — Workforce Management & Intraday Control

An additive workforce operations page for the existing CALLORIA Vite application. This patch does not replace or modify `vite.config.js`, `main.js`, the agent desk, OJT, supervisor console, 3D assets or existing game systems.

## Included

- Daily agent roster with channel/skill matching.
- Shift assignment with overlap, duration and break validation.
- Draft/published schedule lifecycle and CSV export.
- Date selector for the local planning workspace.
- Intraday status board with a selectable simulated time.
- Planned-versus-actual adherence checks and exception visibility.
- Voice, live chat, email and social 30-minute contact forecast.
- Occupancy target adjustment and staffing workload estimate.
- Coverage, attention alerts, channel staffing summary and activity trail.
- Local browser persistence under `calloria.workforce-control.v48`.

## Installation

Copy the three files inside this package's `public/` folder into the existing CALLORIA repository's `public/` folder. Preserve all existing files. Do not replace Vite configuration or application entry points.

After the updated project is built and deployed, open:

`https://calloria.vercel.app/workforce-control.html`

The route is available only after the three new files have been added to the deployed project.

## Controls

1. Open **Shift schedule** and select the operating date.
2. Assign agents only to channels included in their skill profile.
3. Add draft shifts and publish the daily schedule when the roster is ready.
4. Export the date's roster as CSV when needed.
5. Open **Intraday control**, choose a simulated time and update actual states to test adherence monitoring.
6. Open **Demand forecast** to adjust interval volumes and occupancy assumptions.

## Important boundaries

This is a local simulation, not a connected workforce management system. Seed roster details, forecast volumes and actual agent states are synthetic. It does not read the v4.7 supervisor console's browser storage or centralise data across users/devices. It is not connected to HR/payroll, telephony/ACD, real agent status feeds, email or chat systems.

Staffing estimates use a simple workload formula based on average handling time and occupancy. They do not model Erlang-C, queue arrival distributions, service-level objectives, concurrency, shrinkage or abandonment, and must not be used as a production staffing forecast without validation.

## Files

- `public/workforce-control.html`
- `public/workforce-control.css`
- `public/workforce-control.js`
- `public/workforce-control-engine.js`
- `tests/workforce-control-v48.test.mjs`
- `CHANGELOG.md`
- `VERIFICATION.md`
