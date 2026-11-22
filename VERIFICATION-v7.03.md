# CALLORIA v7.03 — verification report

## Automated local checks

- Existing v7.01 preflight regression tests: 6 passed after fixture update.
- Existing v7.02 post-build artifact audit regression tests: 7 passed.
- New v7.03 npm install-policy regression tests: 7 passed.
- Combined focused test result: 20 passed, 0 failed.
- JavaScript syntax checks: passed for both build tools and all three MJS test files.
- Package manifest JSON parse: passed.
- `.nvmrc` / package Node engine consistency: passed.
- Dependency and npm approval manifest assertions: passed.
- ZIP integrity: passed.

## Specific behaviours tested

- The exact `esbuild@0.25.12` install-script approval is accepted.
- Missing or stale esbuild approvals are rejected.
- Removing the direct esbuild dependency pin is rejected.
- npm installs explicitly configured to ignore scripts are rejected by the install guard.
- The build guard accepts exact installed versions of Vite, Three.js, Supabase JS and esbuild, and rejects an esbuild version mismatch.
- Missing build scripts, dependencies, local Vite plugin imports or Rollup entries remain detected.
- The v7.02 artifact audit continues to validate built HTML entry pages, local references, generated staff GLB manifest/diagnostics and the Vercel `dist` contract.

## Not verified

- A fresh registry `npm install` in a clean environment.
- The complete Vite production build against the full live repository.
- CC0 model downloads during build.
- Vercel deployment.
- Actual browser rendering or 3D placement on desktop or mobile.

The focused tests use isolated fixtures. They validate the guards and audit logic; they are not a substitute for the next Vercel deployment result.
