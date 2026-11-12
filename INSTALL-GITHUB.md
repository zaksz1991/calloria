# Install CALLORIA v6.28

Apply this patch on top of v6.27.

1. Open the CALLORIA GitHub repository.
2. Navigate to `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace that file with the version at the same path in this ZIP.
4. Commit the change to `main` and allow Vercel to build.

No package manifest, lockfile, Vite configuration, Supabase setting, secret, model asset, or production-world source file is changed.

The ZIP also includes the v6.22, v6.23, v6.27, and v6.28 regression tests and the verified runtime fixture. Copy the `tests` directory only if you want the regression suite in the repository.
