# Verification — CALLORIA v4.5.0

## Checks performed in the isolated patch workspace

- `node --check js/outbound-campaign-engine.js` — passed.
- `node --check build/calloria-outbound-campaign-v4-5-plugin.mjs` — passed.
- `node --check vite.config.js` — passed.
- `node --check tests/*.test.mjs` — passed.
- `node --test tests/*.test.mjs` — **17 passed, 0 failed**.
- Outbound transform integration test compiles its transformed `main.js` fixture with Node's parser — passed.
- Idempotency and fail-safe upstream anchor mismatch tests — passed.
- Identity/purpose/permission, decline, callback, opt-out, suppression, critical compliance and persistent transcript engine tests — passed.
- ZIP integrity — checked after packaging.

## Not verified

- Full repository `npm test` against the complete current GitHub checkout.
- Full Vite production build or Vercel deployment.
- Live browser flow against the complete OJT + v4.4 + GLB repository.
- Actual Android/iOS layout and physical-device testing.
- Actual telephony, dialler, real customer contact lists or provider callbacks. No real calls are made by this simulation.
- GLB visual rendering. This release does not modify 3D assets or solve the outstanding GLB display problem.

## Compatibility

This overlay targets the v4.4 integration source shape documented at commit `74e0582`. The Vite plugin is registered after the v4.4 post-transform and requires the v4.4 outbound save anchors. On mismatch it emits a warning and skips the outbound replacement rather than applying a partial transformation.
