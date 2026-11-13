# CALLORIA v6.39 Verification

- Regression suite: **132 tests passed, 0 failed** (`node --test tests/*.test.mjs`).
- Build-plugin JavaScript syntax check: passed (`node --check build/calloria-cc0-staff-glb-bundle-plugin.mjs`).
- Transformed runtime syntax validation: passed in the regression suite.
- New tests cover adapter installation, idempotent runtime transform, queued and interruptive dialogue routing, external DOM event requests, control actions, result correlation, failure reporting, diagnostics, application-owned API preservation, and listener disposal.
- ZIP integrity: checked after packaging.

Not verified: complete Vite production build, Vercel deployment, production browser audio output, or automatic integration from the existing call-handling screen. The call-handling screen must invoke the new API or emit `calloria:staff-dialogue-request`.
