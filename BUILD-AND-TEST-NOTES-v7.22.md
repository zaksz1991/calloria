# Build and test notes — CALLORIA v7.22

## Test execution

Executed the cumulative digital regression suite from this package workspace:

`node --test tests/*.test.mjs`

Result: **101 tests passed, 0 failed**.

The run includes the inherited v7.20 and v7.21 tests plus v7.22 activation tests covering transform order, one-registration composition, response-cycle injection after the v7.20 workflow, multichannel-engine transformation, source drift, partial v7.21 fallback, v7.20 prepatched compatibility, idempotency, unrelated-module isolation, Vite config registration and transformed fixture syntax.

## Syntax checks

- `build/calloria-digital-experience-suite-v722.mjs` passed `node --check`.
- `build/calloria-digital-workflow-suite-v720.mjs` passed `node --check`.
- `build/calloria-digital-response-cycle-v721.mjs` passed `node --check`.
- `vite.config.js` passed `node --check`.
- The full transformed `main.js` fixture passed Node syntax validation.

## Not run

- Full repository `npm test`.
- Full repository `npm run build`.
- Vercel deployment.
- Live browser, provider or physical-device testing.

The package contains the digital feature source overlays and tests, not the complete CALLORIA application. Passing fixture tests do not establish a successful production build.
