# CALLORIA v7.07 — Verification

## Focused tests

| Check | Result |
|---|---:|
| Vite transform and marker compatibility | Passed |
| Transform idempotency | Passed |
| Safe skip for missing world marker | Passed |
| Safe skip for ambiguous insertion anchors | Passed |
| Scene mesh and triangle accounting | Passed |
| GLB staff/office root classification | Passed |
| Effective visibility through hidden ancestors | Passed |
| Camera-frustum classification | Passed |
| Renderer, canvas and WebGL state capture | Passed |
| Diagnostic report formatting | Passed |
| Missing-scene fail-safe | Passed |

Focused regression tests: **11 passed, 0 failed**.

## Static checks

- `node --check` for the Vite plugin: passed.
- `node --check` for the runtime diagnostics module: passed.
- `node --check` for the regression tests: passed.
- ZIP archive integrity: passed.

## Not verified

- Full repository `npm test` suite: not run; the complete current repository source was not available in this working directory.
- Full Vite production build: not run.
- GitHub Actions and Vercel deployment: not run.
- Actual browser scene, GLB placements and physical mobile devices: not tested.

The tests use isolated scene/renderer fixtures. They verify diagnostics calculations and transform behavior, not real asset delivery or visual correctness in production.
