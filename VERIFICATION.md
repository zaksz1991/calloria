# Verification — CALLORIA v6.28

- 29/29 regression tests passed: v6.22 transform-aware bounds, v6.23 deployment/runtime diagnostics, v6.27 articulated idle, and v6.28 adaptive idle.
- `node --check` passed for the Vite plugin, all included test modules, and the runtime fixture.
- The transformed staff runtime generated from the included v1.2 fixture passed `node --check`.
- ZIP integrity was checked after packaging.
- Full Vite build, Vercel deployment, production browser rendering, device FPS, and visual character behaviour were not verified because a complete current CALLORIA repository checkout and production browser session were not available.
