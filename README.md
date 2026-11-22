# CALLORIA v7.24 — Integration & General Customer Experience Defaults

This is a cumulative source overlay for the current public CALLORIA `main` baseline. It carries forward the v7.22 digital experience suite and v7.23 Customer 360 recovery module, activates the latter through one deterministic plugin registration, and corrects the fresh-applicant default from Banking Operations to General Customer Experience.

## What it includes

- v7.22 digital experience suite (v7.15–v7.21 integrations).
- v7.23 Customer 360 Recovery Plan engine, Vite transform, stylesheet and tests.
- v7.24 composition plugin registered immediately after v7.22.
- Fresh applicant defaults: `selectedTrack: 'service'`, `department: 'Customer Experience'`, and the service-track starting salary of ₦170,000.
- Existing saved selections and populated department/salary values are retained. Legacy saves missing department or salary have those fields backfilled from their saved career track.

## Verification scope

- 128 Node regression tests passed.
- All included JavaScript files and the replacement `vite.config.js` passed Node syntax checks.
- ZIP integrity passed.
- Full Vite build and Vercel deployment were not run because the complete repository and its GLB asset tree were not available in this workspace.

This package is not a complete repository replacement. Keep the application's pages, public assets, Supabase settings, environment variables, package manifest and all unrelated Vite plugins.
