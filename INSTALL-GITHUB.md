# Install CALLORIA v6.35 through GitHub

1. Open the CALLORIA repository on GitHub.
2. Open `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace the entire file with the same-path file in this ZIP.
4. Commit the change to the `main` branch.
5. Allow the connected Vercel deployment to run.

Apply this patch over v6.34. Do not add a second copy of the plugin. No package.json, lockfile, Vite configuration, environment variable, Supabase setting, or database migration change is required.

After deployment, inspect the existing staff GLB runtime status for `eyeGazeMorphStaffPlaced` and `eyeGazeMorphTargets`. A zero count means the deployed static staff GLBs do not expose the supported per-eye eye-look morph family; it does not indicate a loader failure.

The ZIP carries the regression suite. Run it with Node's built-in test runner from the extracted patch directory: `node --test tests/*.test.mjs`.
