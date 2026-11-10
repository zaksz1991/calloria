# CALLORIA v3.8.0 verification report

## Checks completed in the patch workspace

- `node --check build/calloria-ojt-glb-activation-plugin.mjs`: passed.
- `node --check tests/calloria-v37-onboarding-glb.test.mjs`: passed.
- `node --test tests/calloria-v37-onboarding-glb.test.mjs`: 10 passed, 0 failed.
- ZIP integrity: checked after packaging.

The focused suite covers Draco + Meshopt setup, original and expanded office device-tier plans, shared asset loader setup, low-tier staff targets, first-person avatar replacement, current main.js callback rewriting from the legacy zero-load label, OJT/briefing gates, and one-time HUD injection.

## Not verified

- Full repository `npm test`.
- Full Vite production build.
- Vercel deployment.
- Browser console/runtime behaviour.
- Any GLB file's actual visual appearance, skeleton, animation, material quality, scale, or placement on the floor.
- Physical Android/iOS rendering and performance.

## Release interpretation

This patch fixes the false-success message and adds runtime evidence. It does not supply missing GLB binaries and cannot claim that any GLB model is now in use until the runtime panel reports successful placement counts greater than zero.
