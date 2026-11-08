# Verification — CALLORIA v2.2

Local checks performed on the upgrade package:

- Node syntax check: `build/calloria-glb-world-plugin.js` — passed.
- Node syntax check: `js/world-gameplay-mission.js` — passed.
- Node syntax check: `tests/calloria-first-shift-activation.test.mjs` — passed.
- Focused Node tests: 7 passed, 0 failed.
- Source contract: anchors matched against the currently inspected `main` branch `js/production-world.js` source as of 2026-11-08.
- ZIP archive: created and checked after packaging.

Not performed:
- Full Vercel production build.
- Live deployment.
- Actual GLB browser render test on the user's handset.
- FPS / GPU-memory benchmark on physical devices.

Those checks must be performed against the resulting deployment. The package does not claim those outcomes.
