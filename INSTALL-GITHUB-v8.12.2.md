# CALLORIA v8.12.2 — GUI Repair Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Baseline:** v8.12.1 already installed at commit `6887618`

## Install the one-file repair

1. Download and extract `CALLORIA-v8.12.2-EXISTING-MIGRATION-TEST-REPAIR-UPDATED-FILES.zip` in Windows File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Open the extracted `CALLORIA-v8.12.2-UPDATED-FILES` folder.
5. Copy its `tests` folder into the existing repository root. Allow `tests/calloria-v811-recovery-handover-verification-integration.test.mjs` to replace the existing file.
6. Add the included `CHANGELOG-v8.12.2.md`, `README-v8.12.2.md`, `INSTALL-GITHUB-v8.12.2.md`, `docs/TEST-RESULTS-v8.12.2.txt` and `UPDATED-FILES.txt`.
7. Do not delete, rename or replace `supabase/` or `supabase/migrations/`. Those are existing production assets and are expected to remain in the repository.
8. Keep `.git`, `public/assets/`, GLB models, `.env` files, `package.json`, `vite.config.js`, all Supabase configuration and existing Vercel settings unchanged.
9. In GitHub Desktop, review the changed-file list. The only application/test source replacement should be the one v8.11 integration test listed in `UPDATED-FILES.txt`.
10. Commit with summary `CALLORIA v8.12.2 — fix existing migrations directory regression test` and push to `main`.

## Expected Vercel result

The Vercel deployment should repeat the existing install preflight, protected prebuild audits, Vite build-start integration gate, cumulative v8.9–v8.12 regression suite, bundle generation and postbuild artifact audit. The reported failure at test 7 should be resolved.

The repair does not touch the build gate or package scripts. It adds no SQL migration, Edge Function, secret, environment variable or dependency.

A deployment is successful only when Vercel reports the production build complete. This package has not itself been deployed to Vercel.
