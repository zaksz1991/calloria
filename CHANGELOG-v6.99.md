# CALLORIA v6.99 — Operations Capacity Outlook

## Upgrade
Adds a directional backlog and demand outlook to the existing Operations Intelligence Command Centre.

The panel uses only the aggregate snapshot already returned by `calloria-operations-intelligence`:
- latest seven valid daily received counts;
- latest seven valid daily resolved counts;
- current active-work backlog.

It calculates average daily intake, average daily resolutions, average net backlog movement, the daily resolution target required to clear current backlog within seven days, and projected backlog at days 1, 3 and 7. Where fourteen observations exist, it also compares demand with the preceding seven-day period.

## Safeguards
- The forecast does not display customer identities, message bodies or case details.
- It does not change routing, staffing, queue state, case ownership, SLA records or saved game data.
- It does not invent missing observations; fewer than three valid daily observations produce an explicit insufficient-history state.
- Zero-volume days are preserved in the baseline.
- Source-anchor drift produces a Vite warning and skips the JavaScript transform instead of aborting the build.
- No Supabase migration, Edge Function change, secret or new dependency is required.

## Files
- `build/calloria-operations-capacity-outlook-v6-99.mjs` — Vite integration plugin.
- `js/operations-capacity-outlook-v6-99.js` — pure calculation engine.
- `styles/operations-capacity-outlook-v6-99.css` — responsive panel styling.
- `tests/operations-capacity-outlook-v6-99.test.mjs` — regression tests.

## Release type
Additive overlay for the current public `main` Operations Intelligence page. It is not a complete repository replacement.
