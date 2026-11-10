# CALLORIA v3.7.1 verification

- `node --check build/calloria-ojt-glb-activation-plugin.mjs`: PASS.
- `node --check build/calloria-ojt-runtime.js`: PASS.
- `node --test tests/calloria-v37-onboarding-glb.test.mjs`: 9 passed, 0 failed.
- ZIP integrity: checked after packaging.

Not run / not claimed:
- Full repository `npm test`.
- Full Vite production build (the complete current repository was not available in the patch workspace).
- Vercel deployment or live browser test.
- Runtime fetch/render validation of GLB assets.
- Android/iOS visual inspection or FPS profiling.
