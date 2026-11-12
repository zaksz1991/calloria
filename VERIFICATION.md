# Verification — CALLORIA v6.30

- 49/49 regression tests passed across 6 test files.
- `node --check` passed for the build plugin and all test modules.
- The transformed staff runtime generated from the included v1.2 fixture passed `node --check`.
- ZIP integrity is checked after packaging.
- Full Vite build, Vercel deployment, production browser rendering, and visual behaviour against the deployed third-party GLB rigs remain unverified because a complete current CALLORIA repository checkout and production browser session were not available.

## Regression test counts
- `calloria-v622-transform-aware-bounds.test.mjs`: 6 passed
- `calloria-v623-runtime-diagnostics.test.mjs`: 4 passed
- `calloria-v627-articulated-staff-idle.test.mjs`: 11 passed
- `calloria-v628-adaptive-staff-idle.test.mjs`: 8 passed
- `calloria-v629-tier-aware-idle.test.mjs`: 10 passed
- `calloria-v630-staff-micro-gesture.test.mjs`: 10 passed
