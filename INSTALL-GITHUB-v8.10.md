# CALLORIA v8.10 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production:** `https://calloria.vercel.app`

## Install

1. Use the existing `zaksz1991/calloria` checkout and Vercel project.
2. Extract `CALLORIA-v8.10-RECOVERY-HANDOVER-UPDATED-FILES.zip`.
3. In GitHub Desktop, select **Repository → Show in Explorer**.
4. Merge the archive folder contents into the existing repository root.
5. Replace the existing files listed below. Add the new engine, tests and documentation files.
6. Do not delete `.git`, `public/assets/`, GLB models, `.env`, Supabase configuration, Vercel configuration or any other application files.
7. Keep the existing Vite registration for `calloriaWorkforceCloudRecoveryPortabilityPluginV809()`; this release replaces that plugin module in place and does not add a second registration.
8. Review GitHub Desktop's changed-file list, commit to `main`, and push.

## Files to replace

- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `styles/calloria-workforce-cloud-recovery-portability-v809.css`
- `package.json` — carries forward v8.9.2's exact Vercel hooks and v8.6 health-check script; adds one focused verification script.

## Files to add

- `js/workforce-trend-cloud-recovery-handover-engine-v810.js`
- `tests/workforce-trend-cloud-recovery-handover-v810.test.mjs`
- `tests/calloria-v810-recovery-handover-integration.test.mjs`
- `CHANGELOG-v8.10.md`
- `README-v8.10.md`
- `docs/TEST-RESULTS-v8.10.txt`
- `UPDATED-FILES.txt`

## In-app acceptance

1. Open the workforce cloud recovery panel in the intended organisation workspace.
2. Run the read-only cloud health check so the recovery plan and organisation scope are available.
3. Mark checklist items only after carrying out the corresponding operator step.
4. Select **Export recovery handover**.
5. Confirm that the browser downloads one `.json` file and one `.txt` file.
6. Confirm that the report shows the checklist progress and explicitly says that checked steps do not prove repairs succeeded.
7. Rerun the cloud health diagnostics independently. Treat their actual results—not the handover percentage—as the recovery outcome.

## Build contract and scope

`package.json` retains these exact protected commands:

- `prebuild`: `node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `check`: `node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `verify:workforce-cloud-health`: `node --test tests/workforce-trend-cloud-health-v806.test.mjs`

No database migration, Supabase Edge Function, secret, environment variable or dependency change is required. The full production build and live Supabase checks have not been run from this overlay.
