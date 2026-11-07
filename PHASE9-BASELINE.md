# CALLORIA Phase 9 — Workforce Control Centre

**Baseline:** CALLORIA repository commit `8b073d1` (Agent Desk) plus the Phase 8 Agent Desk source overlay.

**New page:** `/workforce.html`  
**New Edge Function:** `calloria-workforce`  
**New migration:** `202611070010_calloria_workforce_control.sql`

## What this phase adds

- Staff-only workforce workspace using existing Supabase Auth accounts; no employee can self-register through this page.
- Department-scoped roster planner for the 11 CALLORIA departments.
- Published shifts with local-time input, timezone-aware timestamps, overnight shifts and a four-to-sixteen-hour shift duration limit.
- Planned activity blocks for customer operations, breaks, lunch, briefing, training, coaching, QA, back office, systems administration and prayer breaks.
- Database-level prevention of overlapping published shifts for the same staff member.
- Server-recorded clock-in and clock-out.
- Staff-selected actual activity intervals; one open activity interval per employee is enforced by a partial unique index and transaction-locked database functions.
- Supervisor team roster showing clock-in state, current declared activity and schedule adherence.
- Schedule adherence based on minutes where declared actual activity matches the published plan. It is not a measurement of call quality, customer outcomes, online presence or actual phone availability.
- Standard department briefing creation at **07:30** and **14:00 Africa/Lagos**. Sessions are 30 minutes and can be created for one permitted department or all departments in the supervisor's scope.
- Staff briefing acknowledgement records. Acknowledgement is self-reported; it does not prove physical attendance or that a person read/understood every update.
- Append-only workforce activity events for shift publication, clock-in/out, activity changes and briefing acknowledgement.

## Difference from the existing game shift engine

The existing `js/shift-engine.js` and `js/workforce-engine.js` remain untouched. They handle simulation/career gameplay. This module is a separate, server-backed staff workforce tool for CALLORIA's real operational roles. It does not pretend to connect to a telephone switch, SIP carrier, device-monitoring system or payroll platform.

## Files to add or replace

| Package file | Repository destination | Action |
|---|---|---|
| `workforce.html` | `workforce.html` | Add |
| `js/wfm-engine.js` | same path | Add |
| `js/wfm-workbench.js` | same path | Add |
| `styles/workforce.css` | same path | Add |
| `js/agent-desk-workbench.js` | same path | Replace with included syntax fix |
| `agent-desk.html` | same path | Replace with Workforce navigation link |
| `vite.config.js` | same path | Replace; adds all six HTML entry points while preserving current build settings |
| `package.json` | same path | Replace; keeps existing dependencies/scripts and adds syntax checks for new modules |
| `supabase/config.toml` | same path | Replace with consolidated existing and new Edge Function settings |
| `supabase/functions/calloria-workforce/index.ts` | same path | Add and deploy |
| `supabase/functions/calloria-workforce/deno-globals.d.ts` | same path | Add for static TypeScript checks only |
| `supabase/migrations/202611070010_calloria_workforce_control.sql` | `supabase/migrations/` | Add and apply once |
| `tests/wfm-engine.test.mjs` | `tests/` | Add |
| `tsconfig.edge.json` | same path | Replace with type-check paths for the existing Agent Desk and Workforce functions |

The archive includes a snapshot of `assets/ruffneck-catalog.json` for reference only. Do not overwrite a newer repository catalogue with it.

Do not replace `index.html`, `main.js`, `game.js`, `renderer3d.js`, `production-world.js`, the original game workforce/shift engines, existing knowledge files, existing CRM/case modules or other protected game files.

## Build-stability corrections included

The Agent Desk source committed in `8b073d1` contains a single-quoted string whose apostrophe in `platform's` causes the Vercel parser error reported from `js/agent-desk-workbench.js`. The included replacement uses a valid double-quoted JavaScript string.

The currently published Vite configuration does not list the additional HTML workspaces as Rollup build inputs. This package provides a full `vite.config.js` that includes `index.html`, `customer-care.html`, `case-desk.html`, `customer-360.html`, `agent-desk.html` and `workforce.html`. This is required for all workspaces to be emitted as production pages. It retains the current base, output directory, target, sourcemap, inline-asset limit, Three.js chunk rule, server and preview settings.

The included `package.json` retains the current Vite, Three.js and Supabase dependencies. No dependency upgrade is required for this phase.

## Supabase installation and secrets

1. Confirm Phase 8 migration `202611070009_calloria_agent_desk.sql` is applied before using Workforce Control. Check Supabase migration history; do not execute the same migration twice.
2. Check migration history for `202611070010_calloria_workforce_control.sql`. Apply migration 010 exactly once if it is not already recorded as applied.
3. Deploy the `calloria-workforce` Edge Function.
4. Ensure the function is configured with `verify_jwt = false`. The function independently validates the signed-in user's bearer token using `admin.auth.getUser(token)` and rejects accounts not present in the server-side workforce access map. Do not remove that handler-level validation.
5. In **Supabase → Edge Functions → Secrets**, configure:
   - `CALLORIA_ALLOWED_ORIGINS`: exact allowed application origins, including `https://calloria.vercel.app` and only the localhost origins actually used.
   - `CALLORIA_WORKFORCE_ACCESS`: a JSON map of existing Supabase Auth user UUIDs to workforce roles and department scopes.

Example only — replace all UUID placeholders with existing employee Auth IDs:

```json
{
  "11111111-1111-4111-8111-111111111111": {
    "role": "wfm_admin",
    "departments": ["*"]
  },
  "22222222-2222-4222-8222-222222222222": {
    "role": "supervisor",
    "departments": ["RuffNeck Products and Platform Support", "Sales and Service Enquiries"]
  },
  "33333333-3333-4333-8333-333333333333": {
    "role": "agent",
    "departments": ["Email and Written Support"]
  }
}
```

`wfm_admin` requires `departments: ["*"]`. `agent` users must have explicit department grants. Supervisors can be granted all departments or only their managed departments. Only accounts explicitly listed in this secret can enter Workforce Control or be selected for a shift. Use the actual existing Auth UUIDs; do not create fictitious user IDs.

The Edge Function also uses Supabase's server-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service-role key, workforce access map or other secrets in Vercel browser variables, source files, this ZIP or chat.

The workforce access map is separate from `CALLORIA_AGENT_WORKSPACE_ACCESS`, `CALLORIA_CASE_AGENT_ACCESS` and `CALLORIA_CRM_AGENT_ACCESS`. Being an Agent Desk user does not automatically grant roster-management rights.

## Supabase config preservation

The included complete `supabase/config.toml` retains the existing `calloria-ai-assist` and `calloria-game-telemetry` verification settings and the Phase 5–8 customer-care, case-desk, customer-360 and agent-desk function entries. It adds `calloria-workforce`. The AI Assist function remains `verify_jwt = true`; the other listed functions validate their own user token or apply their own endpoint-specific access rules.

## Operational boundaries

- Workforce timestamps are stored as `timestamptz`; the standard briefings are generated in `Africa/Lagos` local time.
- Staff select their own actual activities. No camera, microphone, GPS, keylogging or desktop monitoring is used.
- Team adherence is a work-schedule metric only. It must not be used alone for promotion, discipline or quality scoring. Compare it with role-appropriate KPIs, customer outcomes, QA reviews and approved leave/training records.
- Briefing acknowledgement is an attendance acknowledgement, not verified physical attendance or proof of comprehension.
- This phase does not implement annual promotion exams, leave approvals, payroll, overtime payments, workforce forecasting, skill-based routing or automated shift notifications. The existing game promotion simulation is not changed.
- It does not create or change the accounts on RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run or Kano Keke.

## Verification

See `VERIFICATION.md`. The focused WFM unit tests, browser module syntax, Agent Desk syntax correction, Edge Function static TypeScript check, HTML selector check and SQL namespace/RLS scan passed in the package workspace. The complete root project build, full existing test suite, SQL execution, live Supabase authentication and Vercel deployment were not run here.
