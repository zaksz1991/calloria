# CALLORIA v6.72 — Updated Files Installation

This archive contains updated files only. Apply it on top of the repository that already contains v6.71 and the earlier CALLORIA updates.

1. Extract the ZIP in File Explorer.
2. Open the existing CALLORIA repository folder in GitHub Desktop using **Repository → Show in Explorer**.
3. Copy the extracted `js/`, `styles.css`, `package.json`, `CHANGELOG.md`, `docs/` and `tests/` contents into the repository root, preserving the same folder paths.
4. Allow the included files to replace their matching versions. Do not delete unrelated files.
5. Preserve the existing `public/assets/` folder, all GLB models, other `public/` files and the hidden `.git` directory.
6. Review the GitHub Desktop changed-file list. Commit with `CALLORIA v6.72 — supervisor escalation ownership and response control`, then push to `main`.
7. Check the Vercel deployment result. A successful push is not proof that the production build or runtime passed.

No Supabase migration or new environment variable is required.
