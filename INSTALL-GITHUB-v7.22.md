# Install CALLORIA v7.22 — GUI workflow

This package carries forward the v7.20 and v7.21 digital source files and activates them through one Vite registration.

## Before replacing files

1. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
2. Create a backup branch or commit the current working state.
3. Use **Repository → Show in Explorer**.
4. Extract the v7.22 ZIP into a separate folder.

## Merge the package

1. Copy the package's `build/`, `js/`, `styles/` and `tests/` folders into the repository root, allowing the files to merge.
2. Replace the repository root `vite.config.js` with the complete `vite.config.js` supplied in this package.
3. Do not separately register `calloriaDigitalWorkflowSuitePluginV720()` or `calloriaDigitalResponseCyclePluginV721()`. The replacement config registers only `calloriaDigitalExperienceSuitePluginV722()`.
4. Keep the existing root `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `vercel.json`, environment files, Supabase files, application pages and `public/assets/` unchanged.

## Commit

Commit message:

`CALLORIA v7.22 — activate consolidated digital experience suite`

Push the `main` branch through GitHub Desktop. Check the GitHub Actions result and then the Vercel deployment log.

## Expected build behaviour

The final Vite plugin now applies the digital workflow transforms in this order:

1. v7.15 response coach
2. v7.16 customer-state metrics
3. v7.17 specialist handoff
4. v7.18 SLA-aware triage
5. v7.20 disposition evidence
6. v7.21 follow-up response-cycle SLA

A source-anchor mismatch is reported as a build warning; no speculative partial source rewrite is performed by the individual failed transform. The full repository build has not been run in this package workspace.
