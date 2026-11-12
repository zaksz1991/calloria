# Install v6.34 through GitHub

1. Open the CALLORIA repository on GitHub.
2. Open `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace the entire file with the same-path file in this ZIP.
4. Commit the change to the `main` branch.
5. Allow the connected Vercel deployment to run.

Apply this patch over v6.33. Do not add another copy of the plugin. No package.json, lockfile, Vite configuration, environment variable, Supabase setting, or database migration change is required.

After deployment, inspect the staff GLB diagnostics for `expressionMorphStaffPlaced` and `expressionMorphTargets`. A zero count means the deployed staff models do not expose any morph targets supported by this controller; it is not evidence of a loader failure.
