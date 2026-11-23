# CALLORIA v8.12.3 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`

## Install

1. Back up the existing local CALLORIA repository folder.
2. Extract `CALLORIA-v8.12.3-MIGRATION-NEUTRAL-RELEASE-GUARD-UPDATED-FILES.zip` in File Explorer.
3. Open the existing repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. Merge the extracted `tools/`, `tests/` and `docs/` folders into the existing repository root.
5. Replace the three files listed under **REPLACE** in `UPDATED-FILES.txt`. Add the new migration-neutrality test and release documents.
6. Preserve `.git`, `public/assets/`, all GLB models, all other application files, existing Supabase migrations, `.env` files and Vercel/Supabase settings.
7. Review the changed-file list. Confirm no `package.json`, `package-lock.json`, `vite.config.js`, migration SQL, Edge Function or secret changed.
8. Commit with summary `CALLORIA v8.12.3 — migration-neutral recovery release guard` and push to `main`.
9. Wait for the existing Vercel integration to finish its deployment. Treat the release as deployed only after the production build reports success.

## What the next Vercel build should verify

The production integration gate will run the cumulative v8.9–v8.12 test set plus the new migration-neutrality fixture tests. The migration fixture tests execute the existing v8.11 verifier with (a) no migrations directory and (b) two pre-existing SQL files. They check that the SQL file names and bytes are unchanged.

The release does not apply, rerun, delete or modify any Supabase migration. Do not run SQL for this release.

## Important status boundary

The local cumulative recovery gate passed with 52 tests. This is not proof that the complete repository's Vite build, Vercel deployment, live Supabase session/RLS behaviour or phone-browser gameplay has passed. Verify those from the next deployment and real application session.
