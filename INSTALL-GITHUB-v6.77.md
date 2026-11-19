# CALLORIA v6.77 — GitHub Desktop installation

This is an updated-files overlay for the v6.76-integrated `zaksz1991/calloria` repository. It is not a complete repository replacement.

1. Extract the ZIP in File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the contents of `CALLORIA-v6.77-UPDATED-FILES` into the repository root, allowing matching files to be replaced.
4. Confirm these paths are updated or added:
   - `js/main.js`
   - `js/assessment-flow-engine.js`
   - `public/calloria-mobile-responsive-v6-10.css`
   - `tests/calloria-assessment-keyboard-v677.test.mjs`
   - `CHANGELOG.md`
   - `docs/CALLORIA-v6.77-RECRUITMENT-ASSESSMENT-ACCESSIBILITY.md`
   - `INSTALL-GITHUB-v6.77.md`
   - `VERIFICATION-v6.77.md`
5. Preserve every other repository file, especially `.git`, `public/assets/`, all GLB models, and the existing Supabase configuration and migrations.
6. Review the changed-file list and commit as `CALLORIA v6.77 — assessment keyboard and viewport hardening`.
7. Push `main`, then confirm the Vercel build and browser behaviour independently. This package does not claim a GitHub push or deployment.

No database migration, secret, environment variable or dependency change is required.
