# CALLORIA v7.04 — Production build recovery

Cumulative overlay for the existing `zaksz1991/calloria` repository.

## Immediate production repair

The current public `main` manifest contained only a test script while the Vercel project continued to invoke `npm run build`. This package restores the application manifest and direct dependency declarations required by the existing Vite configuration.

## Included changes

- `package.json`: restores `build`, `dev`, `preview`, `check`, `test`, prebuild and postbuild scripts; restores Vite, Three.js, Supabase and esbuild versions.
- `.nvmrc`: retains Node 22.16.0; `engines.node` is 22.x.
- `.npmrc`: strict npm dependency lifecycle-script policy.
- `allowScripts`: approves only `esbuild@0.25.12`.
- `tools/calloria-build-preflight.mjs`: checks the manifest, local Vite imports, all configured input files, Vercel build contract and safe optional-avatar plugin contract.
- `build/calloria-third-person-player-plugin.mjs`: preserves the existing v2.6 player/camera/workstation behaviour while making optional player integration fail open on source drift.
- `.github/workflows/calloria-production-build.yml`: CI build gate for main pushes, pull requests and manual runs.
- Tests and documentation for the build repair.

## Installation type

This is an additive/cumulative overlay, not a complete source repository. Merge it into the existing repo. Keep all application pages, `js/`, `styles/`, `public/`, GLB assets, Supabase files, `vite.config.js` and `vercel.json`.

Read `INSTALL-GITHUB-v7.04.md` before copying files. Do not upload secrets or environment files.
