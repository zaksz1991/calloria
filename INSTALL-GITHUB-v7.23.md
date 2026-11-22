# CALLORIA v7.23 — Installation

## Package type

Additive source overlay for the current public `main` branch. It is not a complete repository replacement.

## Files included

- `js/customer-recovery-plan-engine-v723.js`
- `build/calloria-customer-recovery-plan-v723.mjs`
- `styles/customer-recovery-plan-v723.css`
- `tests/customer-recovery-plan-v723.test.mjs`
- `tests/fixtures/customer-continuity-panel.fixture.js`

## Install with GitHub Desktop and File Explorer

1. Back up the current CALLORIA repository folder.
2. Extract this ZIP.
3. Copy the supplied `js`, `build`, `styles` and `tests` folders into the repository root. Merge folders when Windows asks; do not delete existing files.
4. Open the repository's existing `vite.config.js`.
5. Add the v7.23 import and plugin registration exactly as shown in `VITE-CONFIG-ADDITIONS-v7.23.txt`.
6. Keep `calloriaDigitalExperienceSuitePluginV722()` registered. The v7.23 plugin must run immediately after it.
7. Save the changes, review them in GitHub Desktop, commit and push `main`.

Suggested commit:

`CALLORIA v7.23 — Customer 360 recovery plan`

## What the new panel uses

It reads the existing `state.customerContinuity` data through `getCustomerContinuityContext()`. The panel appears in the existing Customer 360 continuity component, which is already used on inbound voice, outbound voice and digital support screens.

The assessment uses the same simulated clock passed to the active screen. It identifies open follow-ups, repeat contacts within 24 simulated hours, cross-channel history, and previous low QA or sentiment scores where those values actually exist.

## Preserve

Do not replace `package.json`, `vite.config.js`, `index.html`, `vercel.json`, Supabase configuration, environment variables, existing digital suite files or any `public/assets/` GLB files. Only make the two Vite edits described above and merge the five files listed above.

No database migration, new dependency, environment variable or cloud permission is required.
