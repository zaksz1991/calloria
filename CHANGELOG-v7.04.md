# CALLORIA v7.04 changelog

## Production build recovery

- Restored the root `package.json` name/version and the Vite production build script.
- Restored exact direct dependency declarations for Vite 6.4.5, Three.js 0.170.0, Supabase JS 2.119.0 and esbuild 0.25.12.
- Retained Node 22.x and `.nvmrc` 22.16.0.
- Approved only `esbuild@0.25.12` for its npm lifecycle script and enabled strict npm lifecycle-script enforcement.
- Added a pre-install/pre-build manifest guard, including validation of local Vite imports, build entries, Node pin, npm policy, third-person plugin contract and the existing Vercel install/build/output settings.
- Carried forward the post-build artifact audit; no rewrite of the Vite config or Vercel config is required.

## Third-person transform hardening

- Retained the existing v2.6 third-person functionality and its `enforce: 'post'` ordering after the GLB world transform.
- Preserved the desktop follow camera, player movement/animation updates, workstation activity signals and immersive visibility handling.
- Preserved first-person touch/mobile mode and deferred optional desktop GLB loading.
- Supports both current and v6.84-transformed disposal/immersive source contracts.
- Source-anchor drift now emits a Vite warning and skips this optional avatar enhancement rather than failing the entire build or partially rewriting the world module.

## Continuous integration

- Added `.github/workflows/calloria-production-build.yml` for pushes and pull requests to `main`, plus manual runs.
- CI installs the repository Node version and npm 11, installs dependencies, runs the full test suite, checks the source graph, builds the app and executes the post-build artifact audit.

No Supabase migration, production data, Vercel environment variable, application entry page or existing Vite plugin registration is changed.
