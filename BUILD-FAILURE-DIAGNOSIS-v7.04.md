# CALLORIA v7.04 — Build failure diagnosis

## Confirmed production blocker

The public `main` branch manifest inspected for this package contains only a `test` script. It does not declare `build`, Vite, Three.js or Supabase. The current Vercel configuration still runs `npm install`, `npm run build` and publishes `dist/`. That mismatch explains the supplied `Missing script: "build"` failure and why npm removed the previously installed application dependencies after the minimal manifest was committed.

## npm install-script warning

The Vercel log also reported that the `esbuild@0.25.12` postinstall was not approved. v7.04 restores the exact dependency pin and permits only `esbuild@0.25.12` in npm's `allowScripts` policy. `.npmrc` enables `strict-allow-scripts=true`; a future dependency that introduces a new unreviewed install script will stop installation and require an explicit review rather than being silently skipped.

## Third-person plugin hardening

The older Vercel log showed a historical third-person plugin failing on a missing `combinedAssetStatus` anchor. The current public `main` has since moved to a v2.6 player plugin that uses the render-ready callback and the `updatePlayer(delta)` loop. That current plugin still calls Vite's fatal `this.error()` if one of its source anchors changes.

v7.04 retains the existing v2.6 behaviour, including its post-transform order after the GLB world plugin, desktop follow camera, workstation activity events, mobile first-person mode, idle-time GLB loading and disposal hooks. It changes source drift to a warning and a safe skip. It supports both the original world-disposal block and the v6.84 GLB-transformed disposal/event shape. It does not replace the GLB world plugin or change Vite plugin registration order.

## Automated build gate

A GitHub Actions workflow is added for pushes and pull requests to `main`. It installs Node 22 and npm 11, runs the same dependency install, test suite, manifest preflight, Vite production build and post-build artifact audit. It gives the repository a CI signal before relying on Vercel as the only build check.

## Verification boundary

- 32 focused regression tests pass in the overlay workspace.
- JavaScript syntax checks pass for the changed modules and transformed player-world fixtures.
- The complete CALLORIA repository and installed application dependencies were not available as a local checkout for a full Vite build.
- GitHub Actions has not run on the user's `main` branch.
- Vercel production deployment and physical-device tests remain unverified.
