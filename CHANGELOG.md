# v6.8 Changelog

## Intelligent Omnichannel Routing & SLA Control

- Added a dedicated queue-routing engine with team-aware skill profiles.
- Added editable channel and product proficiency levels, saved per employee/team in browser storage.
- Added explainable Smart Routing, Priority First and Oldest Waiting queue modes.
- Added next-best-contact panel with reasons, response SLA state and skill fit.
- Added 30-second recommendation/queue-time refresh when safe to refresh the idle queue.
- Added routing acceptance snapshots and completed-contact / shift-report evidence.
- Preserved v6.7 omnichannel interactions and previous Live Floor functionality.
- Did not add external services, AI endpoints, API keys, database migrations or Vite configuration changes.

## Known boundaries

- Synthetic contacts only; no live ACD or multi-agent assignment.
- Local browser storage only; no shared server persistence.
- Heuristic SLA/routing scores, not contractual SLA or workforce optimisation.
- Full Vite build, Vercel deployment and browser E2E were not verified.
