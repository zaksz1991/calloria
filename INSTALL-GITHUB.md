# Install CALLORIA v3.5.1 through GitHub Desktop

Target: `zaksz1991/calloria`, branch `main`, current build-failure commit `96649f9`.

1. Extract this ZIP using File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Open the extracted `CALLORIA_v3_5_1_Production_Build_Repair` folder.
5. Copy its `build` and `tests` folders into the repository root. Allow Windows to replace the two matching files.
6. In GitHub Desktop, review the changes. The intended changes are exactly:
   - `build/calloria-first-working-shift-v3-5-plugin.mjs` — complete replacement.
   - `tests/calloria-first-working-shift-v3-5.test.mjs` — complete replacement with 12 focused regression tests.
7. Commit with: `CALLORIA v3.5.1 — stabilize production build transforms`.
8. Push to `main` and inspect the new Vercel deployment log.

Do not copy an outer wrapper directory into the repository. Do not delete `.git`, alter environment variables, run database SQL or replace `vite.config.js` for this repair.

The hotfix does not make a successful deployment claim. Vercel must run the full production build after this commit.
