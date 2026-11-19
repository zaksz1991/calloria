# CALLORIA v6.75 — GitHub Desktop installation

This package contains only updated folders and files. It is an overlay for the v6.74-integrated `zaksz1991/calloria` repository, not a full repository replacement.

## Apply the files

1. Download and extract `CALLORIA-v6.75-RECRUITMENT-ASSESSMENT-VISIBILITY-UPDATED-FILES.zip` in File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Open the extracted `CALLORIA-v6.75-UPDATED-FILES` folder. Copy its contents into the existing repository root, allowing the two existing source files and `CHANGELOG.md` to be replaced.
5. Confirm these paths were updated or added:
   - Replace `js/main.js`.
   - Replace `public/calloria-mobile-responsive-v6-10.css` with the included complete file. Do not append only the new CSS section.
   - Add `tests/calloria-assessment-visibility-v675.test.mjs`.
   - Add `docs/CALLORIA-v6.75-ASSESSMENT-VIEWPORT-REPAIR.md`.
   - Replace `CHANGELOG.md`.
   - Add `INSTALL-GITHUB-v6.75.md` and `VERIFICATION-v6.75.md`.
6. Keep the rest of the repository unchanged. In particular, do not delete `.git`, do not replace `public/assets/`, and preserve all existing GLB models and previous v6.58–v6.74 modules.
7. In GitHub Desktop, review the changed-file list and commit with: `CALLORIA v6.75 — recruitment assessment visibility repair`.
8. Push to `main` to trigger the existing Vercel integration. A successful deployment must be confirmed from Vercel; this package does not claim that deployment has occurred.

## No backend setup

No Supabase migration, secret, environment variable, provider credential or dependency update is required. The release changes the candidate assessment presentation and its existing UI wiring only.
