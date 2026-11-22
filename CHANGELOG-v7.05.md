# CALLORIA v7.05 — Navigation & Application View Integrity

## Purpose

v7.05 extends the v7.04 production recovery overlay with a pre-build audit of the application's multi-page routes and the central simulator's dynamic view navigation. It does not add another dashboard or change customer-service gameplay.

## Changes

- Audits every `.html` page declared as a Vite/Rollup entry.
- Checks local links, page routes, form destinations, scripts, stylesheets, icons, images, media and iframe sources referenced by configured HTML pages.
- Resolves extensionless routes using the repository's Vercel `cleanUrls` setting (for example `/case-desk` to `case-desk.html`).
- Checks that each `data-view` item in the simulator's home navigation exists in the `renderView()` page metadata and switch cases in `js/main.js`.
- Checks that every view metadata entry and switch case has a matching counterpart, and that literal `state.currentView` assignments refer to known views.
- Checks for the `#viewRoot` render container and delegated navigation event handler.
- Runs from both `npm run check` and the production `prebuild` lifecycle.
- Includes eight focused regression tests for valid routes, missing routes/assets, view mismatches, whitespace tolerance and clean-URL routing.

## Boundaries

- Does not edit `index.html`, `js/main.js`, `vite.config.js`, `vercel.json`, customer data, game saves, Supabase or GLB assets.
- Does not follow or test third-party URLs or external service availability.
- Static inspection cannot prove that a page renders or that a click workflow succeeds in a real browser; production build and browser acceptance remain required.
- The package carries forward the v7.04 build recovery files and is a cumulative overlay, not a full repository export.
