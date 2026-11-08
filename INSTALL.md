# CALLORIA Customer Avatar Build Fix

## Fixes

- Normalizes CRLF/LF in memory before checking Vite transform anchors.
- Replaces the brittle multi-line function-boundary string with a unique next-function locator and a closing-brace check.
- Serializes customer follow-up dialogue with `JSON.stringify`, preventing raw line breaks from breaking JavaScript string literals.
- Keeps `js/main.js` and `js/customer-intelligence-engine.js` untouched.

## Apply

1. In the CALLORIA repository, replace `build/calloria-customer-avatar-plugin.js` with the file at the same path in this package.
2. Add `tests/customer-avatar-build-regression.test.mjs`.
3. Commit both files to `main`.
4. Let the existing Vercel deployment rebuild.

Do not replace `vite.config.js`, `package.json`, `js/main.js`, `js/customer-intelligence-engine.js`, or any GLB assets for this repair.

## Local checks included

The regression test covers CRLF main-source input, transformation placement, idempotence, valid multiline dialogue syntax, and safe failure when a source anchor is missing.

The full application/Vercel build must still be confirmed by the next deployment.
