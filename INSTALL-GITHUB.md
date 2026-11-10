# Install CALLORIA v3.7.2 through GitHub Desktop

Target: `zaksz1991/calloria`, branch `main`, current failing commit `aa25c54`.

1. Download and extract this ZIP.
2. Open the existing repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the contents of the ZIP's `CALLORIA_v3_7_2_OfficePlan_AnchorRepair` folder into the repository root, preserving the folder paths.
4. Replace only:
   - `build/calloria-ojt-glb-activation-plugin.mjs`
   - `tests/calloria-v37-onboarding-glb.test.mjs`

The ZIP also contains an unchanged copy of `build/calloria-ojt-runtime.js` solely as a focused-test dependency. It must not be copied over the repository version.
5. Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `build/calloria-ojt-runtime.js`, application pages, model registry or any GLB files.
6. Review the two changed files in GitHub Desktop. Commit as `CALLORIA v3.7.2 — preserve v2.9 GLB workstation plan` and push to `main`.
7. Inspect the next Vercel deployment log. A successful Vite build is not assumed until Vercel reports it.

No SQL migration, environment-variable change or Supabase action is required for this patch.
