# CALLORIA v6.74 — Updated Files Installation

This archive contains only the files changed for v6.74. Apply it on top of the repository that already contains v6.73 and the earlier CALLORIA updates.

1. Extract the ZIP in Windows File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the included `js/`, `tests/` and `docs/` folders, plus `index.html`, `styles.css`, `package.json`, `CHANGELOG.md`, `INSTALL-GITHUB-v6.74.md` and `VERIFICATION-v6.74.md`, into the repository root. Keep the included folder paths unchanged.
4. Allow the new engine and tests to be added and the matching application, navigation, stylesheet and package files to be replaced.
5. Preserve `public/assets/`, all GLB models, all other `public/` files and the hidden `.git` directory. This updated-files archive does not contain or replace those assets.
6. Review the changed-file list in GitHub Desktop. Commit with `CALLORIA v6.74 — agent shift handover and open work continuity`, then push to `main`.
7. Check the Vercel deployment result separately. Passing local tests does not establish a successful production build or deployment.

No Supabase migration, environment-variable change, new npm dependency or public asset change is required.
