# Install CALLORIA v6.27

Apply this patch on top of v6.26.

1. Open the CALLORIA GitHub repository.
2. Navigate to `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace that file with the version at the same path in this ZIP.
4. Commit to `main` and allow Vercel to build.

No `package.json`, lockfile, Vite configuration, Supabase setting, secret, model asset, or production-world source file is changed.

The patch preserves the existing Vite plugin name and export contract.
