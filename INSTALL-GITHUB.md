# Install CALLORIA v6.30

Apply this patch on top of v6.29.

1. Open the CALLORIA GitHub repository.
2. Open `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace it with the file at the same path in this ZIP.
4. Commit the replacement to `main` and let Vercel run its normal production build.

No package manifest, lockfile, Vite configuration, production-world module, Supabase setting, API key, GLB asset or existing user data is changed.

The ZIP also carries the inherited regression suite and checked v1.2 staff-runtime fixture. The tests are optional repository files; only the build plugin replacement is needed for the upgrade.
