# CALLORIA v7.03 — changelog

- Restores the complete CALLORIA package manifest on the current public `main` baseline.
- Pins `@supabase/supabase-js` 2.119.0, `three` 0.170.0, `vite` 6.4.5 and `esbuild` 0.25.12.
- Restores `dev`, `build`, `preview`, `check`, `test`, preinstall/prebuild and postbuild verification scripts.
- Preserves the v6.99-era Node 22 runtime line and current `.nvmrc` value 22.16.0.
- Adds `allowScripts: { "esbuild@0.25.12": true }`, narrowly authorising the exact esbuild package version whose postinstall was skipped in Vercel's log.
- Extends the build preflight to validate the direct esbuild pin, npm lifecycle approval and exact installed versions before bundling.
- Carries forward the v7.02 post-build HTML, asset, diagnostics, GLB manifest and Vercel output audit.
- Retains the commitment-engine CJS test alongside the MJS test suite.
