# CALLORIA v7.02 — Installation

## Package scope

This is a cumulative build-system overlay based on v7.01. It is not the complete CALLORIA repository. It carries the v7.01 manifest/preflight files forward and adds a post-build output audit.

## Files to merge at the repository root

- `package.json` — v7.01 manifest plus the v7.02 `postbuild` and artifact-audit scripts.
- `.nvmrc` — Node 22 runtime line.
- `tools/calloria-build-preflight.mjs` — preserved v7.01 pre-install/pre-build guard.
- `tools/calloria-build-artifact-audit.mjs` — new output verifier.
- `tests/build-preflight-v701.test.mjs` — preserved v7.01 tests.
- `tests/build-artifact-audit-v702.test.mjs` — seven isolated post-build tests.

Do not replace `vite.config.js`, `vercel.json`, application pages, `main.js`, public assets, GLB files, Supabase files, `.env` files or `.git`.

## GitHub Desktop steps

1. Back up the existing CALLORIA repository folder.
2. Open CALLORIA in GitHub Desktop and select **Repository → Show in Explorer**.
3. Extract this ZIP and merge the files into the repository root. Replace `package.json` and `.nvmrc`; merge the two `tools` and `tests` files without deleting existing tests or tools.
4. Confirm the change list includes the package manifest, runtime pin and two new/retained build tools/tests. No application source or Vite configuration should be deleted.
5. Commit: `CALLORIA v7.02 — post-build artifact integrity audit`.
6. Push to `main` and inspect the Vercel deployment logs.

## Expected build sequence

1. `preinstall` checks the manifest and Vite source contract.
2. `npm install` installs the declared dependencies.
3. `prebuild` confirms the build dependencies are installed.
4. `vite build` emits the production bundle.
5. `postbuild` checks the built pages, local HTML asset references, chat widget, generated GLB diagnostics, staff model outputs, and Vercel output settings.
6. Vercel deploys `dist/` only if the build and post-build audit both pass.

A failed artifact audit is intentional: it prevents Vercel from publishing an incomplete `dist/` directory. Optional CC0 model download failures appear as warnings as long as the build manifest correctly marks those models unavailable and preserves the fallback runtime.

## Local verification

The included test files can be run by the repository's existing `npm test` script. After a successful Vite build, `npm run verify:build-artifacts` can be run again independently. No terminal steps are required for installing the files; the verification commands are already wired into the deployment lifecycle.

## Limits

The package's focused tests use isolated fixture projects. They do not substitute for the full Vite build or a Vercel deployment. The new audit verifies the contents and internal references of `dist/`; it does not perform a live browser test or claim that 3D assets were visibly rendered.
