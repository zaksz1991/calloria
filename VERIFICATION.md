# CALLORIA v4.1.0 — Verification

## Checks executed in the patch workspace

- Focused OJT shadowing regression tests: **8 passed, 0 failed**.
- `node --check build/calloria-ojt-runtime.js`: **passed**.
- ZIP integrity: checked after packaging.

## Not verified

- Full repository `npm test`.
- Full Vite production build or Vercel deployment.
- Browser-based employee onboarding in the live site.
- Physical Android/iOS layout.

A passing focused test suite is not proof of a passing full build or deployment.
