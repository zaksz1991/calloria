# CALLORIA v8.12.1 — GUI Installation

Repository: `zaksz1991/calloria`  
Branch: `main`  
Vercel project: existing `calloria` project

## Install the overlay

1. Back up the current local CALLORIA repository folder.
2. Extract `CALLORIA-v8.12.1-INTEGRATED-RECOVERY-BUILD-GATE-UPDATED-FILES.zip` in Windows File Explorer.
3. Open the existing repository in GitHub Desktop.
4. Select **Repository → Show in Explorer**.
5. Copy the extracted folder contents into the existing repository root and allow the listed files to replace their matching paths.
6. Keep the hidden `.git` directory. Do not delete or replace `public/assets/`, GLB models, `.env` files, Vercel configuration, Supabase configuration, or any unrelated project file.
7. Review the GitHub Desktop changed-file list. It should contain only the updated package/plugin/test/audit files and the new cumulative audit/test/docs.
8. Commit with summary `CALLORIA v8.12.1 — integrated recovery build gate` and push to `main`.

## Expected Vercel build sequence

The existing Vercel project should continue to use `npm install`, `npm run build`, `dist`, and Node 22. Do not change the protected package scripts or project build settings.

During the next production build, the log should show the normal install preflight and the existing prebuild audits first. When Vite begins building, its plugin `buildStart` hook runs `tools/calloria-v812-recovery-integration-audit.mjs`. That gate reports the 49-test v8.9–v8.12 suite and the dedicated v8.9 audit. Only after they pass does Vite continue bundling. The existing postbuild artifact audit remains active.

The new package script is also available as `verify:workforce-cloud-recovery-bundle`, but no manual terminal command is required for Vercel to run the production gate.

## Files replaced

- `package.json`
- `build/calloria-workforce-cloud-recovery-portability-v809.mjs`
- `tests/calloria-v89-recovery-portability-integration.test.mjs`
- `tools/calloria-v89-recovery-portability-audit.mjs`

## Files added

- `tests/calloria-v812-recovery-integration.test.mjs`
- `tools/calloria-v812-recovery-integration-audit.mjs`
- `docs/TEST-RESULTS-v8.12.1.txt`
- `CHANGELOG-v8.12.1.md`
- `README-v8.12.1.md`
- `INSTALL-GITHUB-v8.12.1.md`

## No database steps

No Supabase SQL migration or Edge Function deployment is required. No new secrets, environment variables or dependencies are introduced. Keep all existing Supabase/Vercel settings unchanged.
