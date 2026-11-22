# CALLORIA v7.01 — Build Guard & Runtime Pin

- Restores the Vite `build`, `dev` and `preview` scripts that were absent from the test-only manifest.
- Restores the required direct dependencies: Vite 6.4.5, Three.js 0.170.0 and Supabase JS 2.119.0.
- Pins Vercel to Node 22.x, matching the repository's existing Node 22 development line and avoiding the open-ended `>=22.12.0` range that permits automatic major upgrades.
- Adds a dependency-free preinstall/prebuild preflight. It checks manifest scripts and packages, Node version alignment, all relative imports in `vite.config.js`, and each configured Rollup input.
- Adds six isolated regression tests for missing build scripts, missing dependencies, missing Vite plugin files, missing entry points and missing installed build dependencies.
- Does not change gameplay, GLB assets, Supabase schema, environment variables, or Vite plugin registration.
