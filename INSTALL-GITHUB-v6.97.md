# Install CALLORIA v6.97 — GitHub Desktop / File Explorer

This is a cumulative overlay, not a complete repository replacement. It depends on the v6.96 CRM workload transform and must run immediately after it.

## 1. Back up

In GitHub Desktop, select the `calloria` repository and choose **Repository → Show in Explorer**. Copy the current repository folder or at least `vite.config.js`, the existing case-workload files and the `build`/`js` folders to a backup location.

## 2. Merge the supplied files

Extract the ZIP into a separate folder. Merge its `build`, `js` and `tests` folders into the repository root. Do not delete files already in those folders.

The package includes the v6.96 workload plugin, engine and stylesheet as dependencies. If v6.96 is already installed, the included copies are the same v6.96 baseline and may be merged over the matching paths.

## 3. Register v6.97 after v6.96

Open `vite.config.js` in the text editor already associated with JavaScript files. Add the v6.97 import and the plugin registration shown in `VITE-CONFIG-ADDITIONS-v6.97.txt`.

Required order in the plugins array:

1. `calloriaCaseFollowUpWorkloadIntelligencePluginV696()`
2. `calloriaCaseRecoveryPlannerPluginV697()`

Both belong after application logic and before the visitor-facing plugins. Do not register either one twice. The v6.97 plugin intentionally fails the build with a clear message if the v6.96 transform has not run first.

## 4. Preserve existing files

Do not replace `index.html`, `js/main.js`, `js/case-lifecycle-engine.js`, `package.json`, lockfiles, Supabase settings, `.env` files, `public/assets/` or GLB binaries.

Keep v6.94 and v6.95 case-lifecycle safety transforms if they are already installed. This package does not replace them.

## 5. Review and deploy

Return to GitHub Desktop, review the changed files, commit and push to `main`.

Commit message:

`CALLORIA v6.97 — case recovery action planner`

Inspect the actual Vercel build result. A passing local focused test suite is not proof that the complete Vite build or production deployment succeeds.

## 6. Verify in CALLORIA

Open CRM / case management. The new **Case recovery action planner** should appear beneath **Follow-up ownership & workload** and before the existing reopened-case worklist.

Check the following with synthetic game cases:

- Supervisor-review work appears ahead of other cases.
- Overdue and near-deadline cases show the simulated time remaining.
- Off-shift cases are labelled paused rather than incorrectly counted as live countdowns.
- Unassigned and inconsistent claim records have a clear next action.
- **Open case** navigates to the existing CRM case detail.
- No record changes until an existing CRM action is explicitly submitted.
