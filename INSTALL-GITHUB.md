# Install CALLORIA v6.54

This is a **cumulative overlay**, not a standalone application ZIP.

1. Download and extract the ZIP.
2. In the GitHub repository `zaksz1991/calloria`, merge the included `build/` files into the existing `build/` folder. Keep all existing build files; do not delete files that are not in this archive.
3. Merge the included `tests/` files into the existing `tests/` folder.
4. Replace the repository-root `vite.config.js` with the included `vite.config.js`.
5. Commit and push the merged changes to `main`.
6. Review the Vercel deployment result before treating the feature as live.

The replacement Vite configuration registers the cumulative v6.42–v6.54 plugin chain. Do not install only the new v6.54 plugin: it requires the v6.52 support case desk and v6.53 SLA command centre.

## Important

This archive does not include the full source repository, `.env` files, Supabase credentials, API keys or GLB models. It does not modify those items. A complete production build and browser check cannot be certified from this overlay alone.
