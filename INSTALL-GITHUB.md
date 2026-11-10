# Install CALLORIA v3.8.0 through GitHub Desktop

Target repository: `zaksz1991/calloria`, branch `main`.

1. Download and extract the ZIP.
2. Open the existing CALLORIA repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the two supplied folders/files into the repository root, preserving paths.
5. Replace only:
   - `build/calloria-ojt-glb-activation-plugin.mjs`
   - `tests/calloria-v37-onboarding-glb.test.mjs`
   The included `build/calloria-ojt-runtime.js` is an unchanged test fixture dependency only; do not overwrite the repository copy.
6. Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `main.js`, `index.html`, `production-world.js`, `world-player-avatar.js`, the GLB registry, or any model binaries. No database migration or environment-variable change is needed.
7. Review the two changed files, commit as `CALLORIA v3.8.0 — truthful GLB runtime visibility`, then push to `main`.
8. Inspect Vercel's complete production-build log. This package has not been tested as a full repository build and does not claim deployment success.
9. After the deployment succeeds, enter the 3D floor and open `3D ASSET STATUS`. Capture the counts and listed errors. A report of zero GLB placements is a failed asset acceptance test, not a completed upgrade.
