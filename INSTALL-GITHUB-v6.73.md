# CALLORIA v6.73 — Updated Files Installation

This archive contains only the files changed for v6.73. Apply it on top of the repository that already contains v6.72 and the previous CALLORIA updates.

1. Extract the ZIP in Windows File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the extracted `js/`, `tests/` and `docs/` folders, plus `styles.css`, `package.json`, `CHANGELOG.md`, `INSTALL-GITHUB-v6.73.md` and `VERIFICATION-v6.73.md`, into the repository root. Keep the included folder paths unchanged.
4. Allow the updated files to replace their matching versions. Do not delete unrelated project files.
5. Preserve the existing `public/assets/` folder, all GLB models, all other `public/` files and the hidden `.git` directory. This updated-files archive does not contain or replace those assets.
6. In GitHub Desktop, review the changed-file list. Commit with `CALLORIA v6.73 — supervisor shift handover and outstanding work continuity`, then push to `main`.
7. Check the Vercel deployment result. The source-level checks in the verification report do not establish a successful production build or live deployment.

No Supabase migration, environment-variable change, new npm dependency or public asset change is required.
