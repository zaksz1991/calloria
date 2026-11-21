# CALLORIA v6.89 — GUI installation

## Release scope

This is a targeted overlay for the current public `main` source layout inspected on 21 November 2026. It is not a complete repository replacement and does not contain or replace `public/assets/`, GLB models, `.git`, Supabase files, environment files, or the rest of the application.

## Files in this package

| Package file | Destination in repository |
|---|---|
| `index.html` | Replace repository-root `index.html` |
| `js/calloria-shift-review-v6-89.mjs` | Add to repository-root `js/` folder |
| `calloria-shift-review-v6-89.css` | Add beside the existing root `performance-mobile.css` |
| `tests/calloria-shift-review-v6-89.test.mjs` | Add to repository-root `tests/` folder |

## Install using File Explorer and GitHub Desktop

1. In GitHub Desktop, select the `calloria` repository.
2. Use **Repository → Show in Explorer**.
3. Make a backup copy of the existing `index.html`.
4. Copy the package's replacement `index.html` to the repository root and replace the existing file.
5. Open the repository's `js` folder. Copy `calloria-shift-review-v6-89.mjs` into it.
6. Copy `calloria-shift-review-v6-89.css` into the repository root, beside `performance-mobile.css`.
7. Copy the test file into the repository's `tests` folder.
8. Return to GitHub Desktop. Review the changed files. The intended changes are one replacement HTML file and three added files.
9. Commit with `CALLORIA v6.89 — shift close-out performance review` and push to `main`.
10. Check the Vercel deployment log and confirm that the build completes before testing a shift in the browser.

## Runtime behaviour

The v6.89 module is loaded immediately before the existing `/js/main.js` module. It observes the existing `calloria.save.*` and legacy `floorshift3d.save.v1` local-storage records. When a saved state changes from `shiftActive: true` to `shiftActive: false`, it calculates the shift deltas and presents a close-out report.

The report uses existing counters only: inbound calls, outbound attempts, resolutions, sales, newly created CRM cases, customer commitments, QA and CSAT totals/counts, and shift adherence. It does not change promotion eligibility, salary, bonus, QA scores, CSAT values, callback status, or any game progression.

A baseline is retained in session storage during an active shift. When the page is reloaded while a shift is already active and no baseline exists, the report is marked as partial rather than claiming to include activity from before the reload.

## Compatibility warning — verify the deployment branch first

The current public GitHub `main` snapshot inspected for this overlay contains the `CALLORIA · BUILD 1.4.0` shell and a different Vite configuration from the older deployment log showing package version `0.3.0` and the v6.42–v6.86 plugin chain. This package replaces `index.html` from the current public `main` snapshot. Do not install it onto an older checkout that still has the `0.3.0` entry point without first reconciling that branch/source difference.

## Preserved files and services

Do not delete or replace:

- `public/assets/` or any `.glb` files
- `vite.config.js`
- `package.json` or the lockfile
- `.git/`, `.env*`, Vercel settings, Supabase migrations or Edge Functions
- `commitment-engine.js`, `promise-control-engine.js`, or `js/calloria-mobile-world-guard-v6-80.js`

No package dependency, environment variable, secret, Supabase migration, API endpoint or external service is added.
