# Verification — CALLORIA v6.29

- 39/39 regression tests passed across 5 test files.
- `node --check` passed for the plugin, all included test modules, and the runtime fixture.
- The transformed staff runtime generated from the included v1.2 fixture passed `node --check`.
- ZIP integrity is checked after packaging.
- Full Vite build, Vercel deployment, production browser rendering, measured FPS and visual staff behaviour remain unverified because a complete current CALLORIA repository checkout and production browser session were not available.

## Regression test counts
- calloria-v622-transform-aware-bounds.test.mjs: 6 passed
- calloria-v623-runtime-diagnostics.test.mjs: 4 passed
- calloria-v627-articulated-staff-idle.test.mjs: 11 passed
- calloria-v628-adaptive-staff-idle.test.mjs: 8 passed
- calloria-v629-tier-aware-idle.test.mjs: 10 passed
