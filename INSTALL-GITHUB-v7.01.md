# CALLORIA v7.01 — Build guard and runtime pin

## Purpose

The Vercel log for commit `a0623b3` showed npm installing only one package and then failing with `Missing script: "build"`. The public `main` manifest was reduced to a test-only package definition. This release restores the application dependencies and Vite scripts, pins Vercel to Node 22.x, and adds a Node-built-in preflight that checks the package manifest, local Vite plugin imports, configured Rollup entries and installed build dependencies before production compilation.

## Apply these files at the repository root

Merge the ZIP into the existing CALLORIA repository. It contains:

- `package.json` — complete application manifest.
- `.nvmrc` — Node 22 runtime line.
- `tools/calloria-build-preflight.mjs` — preinstall/prebuild source guard.
- `tests/build-preflight-v701.test.mjs` — six isolated regression tests.

Do not replace `vite.config.js`, `index.html`, `main.js`, Supabase files, environment variables, `.git` or `public/assets/`.

## GitHub Desktop steps

1. Back up the current repository folder.
2. Open the CALLORIA repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Extract the ZIP and copy its contents into the repository root. Allow replacement of `package.json` and `.nvmrc`; merge the new `tools` and `tests` files without deleting existing contents.
5. Return to GitHub Desktop. Confirm that only the four intended files are added/changed.
6. Commit with: `CALLORIA v7.01 — build preflight and Node 22 pin`.
7. Push to `main` and inspect the new Vercel deployment.

## Expected Vercel sequence

The install step should now run `preinstall`, verify the package manifest and source references, and install the declared packages. The build step should run `prebuild` before `vite build`. The preflight reports missing local plugin modules or Rollup entry points before Vite begins bundling.

Keep Vercel's Build Command set to `npm run build`. Keep the existing project root and output directory settings. No Supabase migration, key, environment variable or plugin registration is required.

## Scope

This is a build-system overlay, not a complete repository replacement. It does not claim the full Vite build or the Vercel deployment has passed. The v6.99 report's capacity-outlook integration and prior gameplay upgrades remain separate from this manifest repair; preserve the repository's current source files while applying this package-level patch.
