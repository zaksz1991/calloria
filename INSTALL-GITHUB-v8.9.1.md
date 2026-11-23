# CALLORIA v8.9.1 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production:** `https://calloria.vercel.app`

1. Extract `CALLORIA-v8.9.1-VERCEL-BUILD-CONTRACT-REPAIR-UPDATED-FILES.zip`.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Merge the archive contents into the existing repository root. Replace `package.json`, `tools/calloria-v89-recovery-portability-audit.mjs` and `tests/calloria-v89-recovery-portability-integration.test.mjs`; add the release notes and verification record.
5. Preserve `.git`, `public/assets/`, all GLB models, local environment files and the rest of the application source. Do not replace the repository with this overlay.
6. Review the changed files, commit with `CALLORIA v8.9.1 — restore Vercel build contract`, and push to `main`.
7. Confirm the next Vercel run passes `npm install`, then `prebuild`, then `vite build`. The repair only addresses the two `package.json` script mismatches shown in the failed deployment log; later build stages must still be verified from the new deployment log.

## Files replaced
- `package.json`
- `tools/calloria-v89-recovery-portability-audit.mjs`
- `tests/calloria-v89-recovery-portability-integration.test.mjs`

## Files added
- `CHANGELOG-v8.9.1.md`
- `README-v8.9.1.md`
- `docs/TEST-RESULTS-v8.9.1.txt`
- `INSTALL-GITHUB-v8.9.1.md`
- `UPDATED-FILES.txt`

No Supabase migration, Edge Function, secret, Vercel environment variable or dependency change is required.
