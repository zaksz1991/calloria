# CALLORIA v6.76 — GitHub Desktop installation

This archive contains only updated folders and files. It is an overlay for the v6.75-integrated `zaksz1991/calloria` repository, not a full repository replacement.

## Apply the updated files

1. Download and extract `CALLORIA-v6.76-UPDATED-FILES.zip` in File Explorer.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the contents of the extracted `CALLORIA-v6.76-UPDATED-FILES` folder into the existing repository root. Allow the included files to replace matching paths.
5. Confirm the following paths are updated or added:
   - Replace `js/main.js`.
   - Add `js/assessment-flow-engine.js`.
   - Replace `public/calloria-mobile-responsive-v6-10.css`.
   - Replace `public/js/calloria-mobile-ui-guard-v6-10.js`.
   - Replace `package.json` so `npm run check` includes the new engine syntax check.
   - Add `tests/calloria-assessment-progress-v676.test.mjs`.
   - Replace `tests/calloria-assessment-visibility-v675.test.mjs` with the updated viewport/progression regression set.
   - Replace `CHANGELOG.md` and add the v6.76 documentation, install and verification files.
6. Keep all other repository files unchanged. Do not delete `.git`, do not replace `public/assets/`, and preserve all existing GLB models and earlier v6.58–v6.75 modules.
7. Review the changed-file list in GitHub Desktop. Commit with: `CALLORIA v6.76 — recruitment progress and response review`.
8. Push to `main` to trigger the existing Vercel integration. Confirm the Vercel production build separately; this package does not claim a deployment.

## Backend setup

No Supabase migration, secret, environment variable, provider credential or dependency update is required.
