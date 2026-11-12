# Install CALLORIA v6.11 from the GitHub website

1. Open the CALLORIA repository on GitHub and browse to each path in the file table in `README.md`.
2. Open the file, choose **Edit**, replace its contents with the matching file from this ZIP, and save the change.
3. For `js/world-player-avatar-desktop.js`, use **Add file → Create new file**, enter that exact path, paste the matching file contents, and save.
4. Keep the existing `vite.config.js`. The installed configuration already references the mobile plugin by the same filename and exported function.
5. Confirm the commit contains four modified files and one new file:
   - Modified `js/world-player-avatar.js`
   - Added `js/world-player-avatar-desktop.js`
   - Modified `build/calloria-mobile-responsive-repair-v6-10.mjs`
   - Modified `public/calloria-mobile-responsive-v6-10.css`
   - Modified `public/js/calloria-mobile-ui-guard-v6-10.js`
6. Open the Vercel deployment connected to the commit and inspect the complete build result. Do not treat a queued deployment as a successful build.

Do not delete or replace any other runtime module, Vite plugin, Supabase file, model file, or asset folder as part of this patch.
