# Install CALLORIA v6.44

1. Extract this ZIP.
2. In the CALLORIA repository, merge the included `build` folder into the existing `build` folder. Keep all existing project files.
3. Replace the repository's `vite.config.js` with the one in this ZIP. It preserves the current plugin list and appends v6.44 after v6.42 and v6.43.
4. Confirm these three files exist in `build`:
   - `calloria-voice-response-workflow-v6-42.mjs`
   - `calloria-inbound-customer-dialogue-v6-43.mjs`
   - `calloria-inbound-conversation-wrapup-v6-44.mjs`
5. Commit the merged files to the `main` branch using GitHub's web interface or GitHub Desktop. Vercel should then run its configured build.

Do not replace `package.json`, `package-lock.json`, `public/assets/models`, `.env` files, Supabase configuration or API keys. No SQL migration is required.

The ZIP includes the v6.42 and v6.43 plugin modules so the three-step transform chain is present. It does not include the entire CALLORIA repository.
