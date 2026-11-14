# Install CALLORIA v6.53 in GitHub

This is a cumulative build-integration overlay. It is not a full project ZIP.

1. Download and extract `CALLORIA_v6_53_Support_SLA_Command_Centre.zip`.
2. In the extracted folder, open `build/` and upload all included files into the repository's existing `build/` folder. Keep existing unrelated build plugins.
3. Open `tests/` and upload/merge the included tests and fixtures into the repository's existing `tests/` folder. Do not delete unrelated tests.
4. Replace the repository-root `vite.config.js` with the included `vite.config.js`.
5. Commit the merged files to the `main` branch.
6. Review the Vercel deployment log. The production build is not verified by this overlay's focused tests.

Do not replace `package.json`, `package-lock.json`, `.env` values, Supabase settings, API keys, `public/assets/models/` or existing GLB assets. No new package dependency is required.

The replacement Vite configuration registers the cumulative v6.42–v6.53 plugin chain. Install the cumulative `build/` files and configuration together; do not upload only the v6.53 plugin.
