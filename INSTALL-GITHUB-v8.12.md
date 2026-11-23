# CALLORIA v8.12 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production:** `https://calloria.vercel.app`

## Install through GitHub Desktop and File Explorer

1. Back up the existing CALLORIA repository folder.
2. Extract `CALLORIA-v8.12-RECOVERY-HANDOVER-COMPARISON-UPDATED-FILES.zip`.
3. Open the existing repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. Merge the archive's `build`, `js`, `styles` and `tests` folders into the existing repository root. Replace matching files and add the new v8.12 engine and tests.
5. Replace the root `package.json` with the included version. It retains the previous verification scripts and exact Vercel hooks and adds one focused v8.12 verification command.
6. This overlay depends on the v8.11 verifier and v8.10 handover engine already present in the repository. Do not remove those earlier engine files.
7. Keep the existing Vite registration for `calloriaWorkforceCloudRecoveryPortabilityPluginV809()`. Do not register a second copy of the plugin.
8. Preserve `.git`, `public/assets/` and all GLB models, `.env`, all Supabase/Vercel settings, existing migrations, and all files not listed in this overlay.
9. Review the changed-file list. Commit to `main` and push.

## Files to replace

- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `styles/calloria-workforce-cloud-recovery-portability-v809.css`
- `package.json`

## Files to add

- `js/workforce-trend-cloud-recovery-handover-comparison-engine-v812.js`
- `tests/workforce-trend-cloud-recovery-handover-comparison-v812.test.mjs`
- `tests/calloria-v812-recovery-handover-comparison-integration.test.mjs`
- `CHANGELOG-v8.12.md`
- `README-v8.12.md`
- `docs/TEST-RESULTS-v8.12.txt`
- `UPDATED-FILES.txt`

## In-app acceptance

1. Open the Workforce Cloud Recovery panel.
2. Export two handover JSON reports at different times.
3. Confirm the two files were exported from the same organisation. CALLORIA cannot infer organisation identity from the v8.10 report format.
4. Select **Compare two handover reports** and choose exactly two JSON files.
5. Confirm both checksums are validated before the comparison is shown.
6. Confirm the report shows older/newer completion counts, percentage-point movement, and each recovery area's own change.
7. Confirm that a regression in one area remains visible even when another area improved. Mixed movement should be labelled explicitly.
8. Repeat with a modified file whose checksum has not been recalculated. Verification must fail.
9. Confirm that comparison does not import progress, persist a result or change any local or cloud record.
10. Run the read-only cloud health check independently. Checklist progress is not proof of a repair.

## Protected build contract

These exact commands are preserved:

- `prebuild`: `node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `check`: `node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `verify:workforce-cloud-health`: existing v8.6 check
- `verify:workforce-cloud-handover`: existing v8.10 check
- `verify:workforce-cloud-handover-verification`: existing v8.11 check

New focused command: `npm run verify:workforce-cloud-handover-comparison`.

No Supabase migration, Edge Function, secret, environment variable or dependency change is required. This incremental overlay has not been built against the complete repository. Treat deployment as successful only after Vercel confirms install, prebuild, Vite build and postbuild audits.
