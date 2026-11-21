# CALLORIA v6.96 — GUI installation

## Package scope

This is an additive source overlay, not a complete repository replacement. It adds a read-only case follow-up workload panel to the existing CRM view.

## Files to merge

Copy these files into the matching locations in the existing CALLORIA repository:

- `build/calloria-case-followup-workload-intelligence-v6-96.mjs`
- `js/case-followup-workload-engine-v696.js`
- `js/case-followup-workload-v696.css`

The `tests/` and `docs/` folders are verification material; they are not required for deployment.

## GitHub Desktop / File Explorer

1. Make a backup copy of the current `calloria` repository folder.
2. Extract this ZIP into a separate folder.
3. Open GitHub Desktop and select the existing `calloria` repository.
4. Choose **Repository → Show in Explorer**.
5. Copy the supplied `build` and `js` folders into the repository root. Merge folders; do not delete existing files.
6. Open `vite.config.js` in the text editor already associated with JavaScript files.
7. Add the import and plugin registration shown in `VITE-CONFIG-ADDITIONS-v6.96.txt`.
8. Place the registration after the existing application-logic plugins. In the older `c8a48d6` configuration, place it after `calloriaRuffNeckServiceOperationsPluginV686()` and before `calloriaPublicExperienceHubPlugin()`. If `calloriaCareerDevelopmentPluginV688()` is already present, place v6.96 after that instead.
9. Register the import and plugin exactly once. Do not remove the v6.94/v6.95 case-lifecycle plugins if they are already installed.
10. Save `vite.config.js`, return to GitHub Desktop, review the changed-file list, commit, and push to `main`.

## What appears in the game

Open the existing CRM / case management view. Under the four existing reopened-case summary cards, a new **Follow-up ownership & workload** panel appears before the reopened-case worklist.

The panel groups active follow-ups by owner and shows open, urgent, overdue, due-soon, in-progress and supervisor-review counts; the next simulated deadline; recorded claimants; and assignment-metadata exceptions.

The panel is read-only. It highlights missing or inconsistent ownership metadata but does not repair or edit those records. Existing case action buttons and workflows remain the only way to claim or complete work.

## Preserved

- `js/main.js` is transformed at build time, not replaced.
- `js/case-lifecycle-engine.js` is not replaced.
- No `index.html`, 3D assets, GLB files, Supabase tables, environment variables or dependencies are changed.
- Any v6.94/v6.95 plugins already installed should remain registered.

## Deployment check

After pushing, inspect the Vercel build log. The plugin must report no source-rebase error. A successful focused unit suite does not prove a full Vite build or production runtime. If the current branch has changed the CRM anchors, keep the build failure visible and inspect that branch's `js/main.js`; do not delete the safety checks.
