# Install CALLORIA v6.29

Apply this patch on top of v6.28.

1. Open the CALLORIA GitHub repository.
2. Navigate to `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace that file with the version at the same path in this ZIP.
4. Commit the change to `main` and allow Vercel to build.

No package manifest, lockfile, Vite configuration, production-world source, Supabase setting, API key, or GLB asset is changed.

The ZIP also includes inherited regression tests and the v1.2 runtime fixture. Copy the `tests` directory only if you want to retain the optional local regression suite in the repository.
