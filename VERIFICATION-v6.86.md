# CALLORIA v6.86 — verification report

## Automated checks completed

| Check | Result |
|---|---:|
| Combined v6.81–v6.84 GLB diagnostics/path/startup tests | 32 passed |
| v6.85 current-world and v6.84-world compatibility tests | 7 passed |
| v6.86 service operations and source-rebase tests | 8 passed |
| Total bundled Node regression tests | **47 passed, 0 failed** |
| `vite.config.js` syntax | Passed |
| v6.86 plugin syntax | Passed |
| v6.85 third-person plugin syntax | Passed |
| v6.84 GLB world plugin syntax | Passed |
| GLB helper module syntax | Passed |
| ZIP integrity | Passed after archive creation and `unzip -t` validation |

The v6.86 tests cover safe handling of synthetic identifiers, personal-data redaction, priority/SLA calculation, specialist routing, case ownership and history, scoring, the Workforce systems registry, source anchor rebasing, idempotence, game-clock SLA usage and fail-closed behaviour when required anchors drift.

The v6.85 tests cover both the current world source shape and the v6.84-transformed shape, first-render ordering, asynchronous avatar startup, disposal/immersive event compatibility and syntax validation of transformed fixtures.

The v6.84 tests cover GLB path fallback, pending-versus-settled diagnostics, failure counts, deferred model startup, independent staff/office completion and cleanup after world disposal.

## Source-audit findings

The inspected public `main` source still had the old v6.51–v6.54 plugin registrations. Those plugins had already reported missing anchors in the supplied Vercel log. The current source uses the Workforce systems directory renderer, an existing launch-system event path and the current CRM case markup. v6.86 rebases those exact sections and replaces the old plugin chain with one transform.

The current Workforce systems registry included Finacle. The v6.86 registry removes Finacle and adds the six RuffNeck service platforms. FirstMobile, USSD and Postilion remain clearly designated as optional banking-industry systems.

The current `saveState()` calls the existing cloud-employment sync scheduler. Therefore, support case data is not described as strictly local-only: it follows the existing CALLORIA profile storage and may sync to the configured Supabase employment snapshot when that feature is enabled.

## Not verified

- A complete `npm run build` against the full repository was not run because the complete repository checkout was not available in the working folder.
- No Vercel deployment was triggered or inspected after applying this package.
- No physical Android or iOS device test was performed.
- No live GLB fetch, successful model placement, or final visual quality was established.
- No production RuffNeck service account, customer record, payment flow or API integration was tested; none is added by this release.

Do not treat the release as production-deployed until the user's Vercel build succeeds and the browser checks are completed.
