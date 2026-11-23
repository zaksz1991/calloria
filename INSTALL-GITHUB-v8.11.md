# CALLORIA v8.11 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production:** `https://calloria.vercel.app`

## Install through GitHub Desktop and File Explorer

1. Back up the existing CALLORIA repository folder.
2. Extract `CALLORIA-v8.11-RECOVERY-HANDOVER-VERIFICATION-UPDATED-FILES.zip`.
3. Open the existing repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. Merge the archive's `build`, `js`, `styles` and `tests` folders into the repository root. Replace matching files and add the new engine and tests.
5. Replace the root `package.json` with the included version. It carries forward v8.9.2's exact build contract and the v8.6, v8.9 and v8.10 verification scripts, and adds one v8.11 focused test command.
6. Keep the existing Vite registration for `calloriaWorkforceCloudRecoveryPortabilityPluginV809()`. Do not register a second plugin.
7. Preserve `.git`, `public/assets/` and all GLB models, `.env`, all Supabase/Vercel settings, existing migrations, and all files not listed in this overlay.
8. Review the changed-file list. Commit to `main` and push.

## Files to replace

- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `styles/calloria-workforce-cloud-recovery-portability-v809.css`
- `package.json`

## Files to add

- `js/workforce-trend-cloud-recovery-handover-verification-engine-v811.js`
- `tests/workforce-trend-cloud-recovery-handover-v811.test.mjs`
- `tests/calloria-v811-recovery-handover-verification-integration.test.mjs`
- `CHANGELOG-v8.11.md`
- `README-v8.11.md`
- `docs/TEST-RESULTS-v8.11.txt`
- `UPDATED-FILES.txt`

## In-app acceptance

1. Open the Workforce Cloud Recovery panel in the intended organisation workspace.
2. Export a recovery handover report using **Export recovery handover**. This produces JSON and TXT files.
3. Select **Verify handover report** and choose the JSON file.
4. Confirm the panel reports integrity verified and displays the checklist count and percentage.
5. Change one character in a copy of the JSON file and verify it. The modified file must be rejected with a checksum mismatch.
6. Verify that no checklist tick, local progress record, Supabase row or workforce history record changes as a result of verification.

## Preserved build contract

The following exact commands remain unchanged:

- `prebuild`: `node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `check`: `node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs`
- `verify:workforce-cloud-health`: `node --test tests/workforce-trend-cloud-health-v806.test.mjs`
- `verify:workforce-cloud-handover`: the existing v8.10 test command

No Supabase migration, Edge Function, secret, environment variable or new dependency is required. The production build and Vercel deployment must be confirmed by the deployment log after the files are pushed; they have not been run from this incremental overlay.
