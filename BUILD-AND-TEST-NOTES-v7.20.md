# Build and test notes — CALLORIA v7.20

## Regression suite

Command executed in the package workspace:

`node --test tests/*.test.mjs`

Result: **70 tests passed, 0 failed**.

Coverage includes the inherited v7.15–v7.18 feature tests, v7.20 deterministic suite ordering, complete main-source transform fixture, multichannel engine metric transform, specialist-handoff + evidence-gate compatibility, new referral-draft acceptance during the same transaction, idempotency, unrelated-module isolation and post-transform JavaScript syntax validation.

## Syntax and package checks

- 16 JavaScript/MJS files passed `node --check`.
- All direct Vite plugin imports resolve within the package.
- All injected application helper and stylesheet imports resolve within the package.
- Both included stylesheets passed balanced-brace checks.
- The ZIP archive was tested with `unzip -t` after packaging.

## Not run

- Full `npm test` against the complete CALLORIA repository.
- Full `npm run build` / Vite production build.
- Vercel deployment.
- Live browser, real-provider or physical-device tests.

The package workspace contains the digital workflow modules and test fixtures, not the full CALLORIA repository. The transform fixture is constructed from exact public-main anchors, not represented as a full app build.
