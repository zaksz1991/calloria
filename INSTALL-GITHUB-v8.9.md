# CALLORIA v8.9 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production:** `https://calloria.vercel.app`

## Merge the updated files

1. Download and extract `CALLORIA-v8.9-RECOVERY-CHECKLIST-PORTABILITY-UPDATED-FILES.zip`.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Merge the contents of `CALLORIA-v8.9-UPDATED-FILES` into the existing repository root.
5. Replace `vite.config.js` and `package.json` with the included versions. Merge the new `build`, `js`, `styles`, `tools`, `tests` and `docs` files.
6. Keep the existing `.git` folder, `public/assets/` directory, GLB models, all other application files, local environment files and production credentials. Do not replace the repository with this overlay.
7. Review the changed-file list in GitHub Desktop. Confirm the v8.9 plugin is registered after the v8 workforce suite and before the production integration gate.
8. Commit with `CALLORIA v8.9 — verified recovery checklist portability` and push to `main`.
9. Check the existing Vercel deployment. Treat the release as deployed only when Vercel reports a successful production build.

## Expected changed files

**Replace:**
- `vite.config.js`
- `package.json`

**Add:**
- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `js/workforce-trend-cloud-recovery-portability-engine-v809.js`
- `styles/calloria-workforce-cloud-recovery-portability-v809.css`
- `tools/calloria-v89-recovery-portability-audit.mjs`
- `tests/workforce-trend-cloud-recovery-portability-v809.test.mjs`
- `tests/calloria-v89-recovery-portability-integration.test.mjs`
- `CHANGELOG-v8.9.md`
- `README-v8.9.md`
- `docs/TEST-RESULTS-v8.9.txt`
- `UPDATED-FILES.txt`

## Runtime acceptance

1. Open Workforce History and run the read-only cloud health check.
2. Confirm the guided remediation cards display the new Checklist portability section.
3. Mark one or more recovery checklist steps complete.
4. Select **Export checklist backup**. Confirm a JSON file downloads.
5. Open the file in a text editor. Confirm it contains only the CALLORIA format/version, opaque organisation scope, date, checklist shape, fixed remediation IDs, step indexes and SHA-256 checksum. It must not contain the organisation's raw ID or user/customer data.
6. On a second browser/device signed into the same organisation, run the health check to load the same remediation plan.
7. Select **Import checklist backup** and choose the exported file. Confirm CALLORIA verifies it and asks for approval before merging.
8. Confirm existing ticks are retained and imported ticks are added.
9. Try importing the file into another organisation. Confirm the import is rejected.
10. Try an altered or oversized JSON file. Confirm validation fails without changing progress.
11. Rerun the read-only health check. Confirm checklist ticks do not mark diagnostic checks as passed by themselves.

## Configuration impact

No Supabase migration, Edge Function, secret, Vercel environment variable or dependency change is required. Existing production configuration remains unchanged.
