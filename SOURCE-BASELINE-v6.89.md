# CALLORIA v6.89 — Source baseline note

The overlay was prepared against the public `main` snapshot accessible on 21 November 2026.

Observed in that snapshot:

- Root `index.html` identifies `CALLORIA · BUILD 1.4.0`, loads `commitment-engine.js`, `promise-control-engine.js`, `js/calloria-mobile-world-guard-v6-80.js`, and `js/main.js`.
- Root `js/main.js` contains local state counters for calls handled, outbound calls, resolutions, sales, QA and CSAT, and `endShift()` closes the shift and pushes a shift-history row.
- `vite.config.js` registers GLB world, Meshopt, static staff, customer-world, supervisor, first-shift, third-person, workstation and in-world operations plugins. It does not show the older v6.42–v6.86 plugin chain appearing in the supplied Vercel log.

Consequently this release is explicitly an overlay for that public `main` shape. The supplied older deployment log's package version `0.3.0` and its plugin diagnostics must not be treated as proof that the deployed checkout is identical.
