# Verification — CALLORIA v6.35

## Automated checks
- 97/97 Node regression tests passed (86 carried-forward tests and 11 v6.35 tests).
- Replacement build plugin passed `node --check`.
- Transformed staff runtime fixture passed `node --check` validation.
- Tests cover supported eye-look names, static-model gating, safe morph indices and ranges, anatomical left/right mapping, occasional smooth glance timing, baseline restoration, authored-animation exclusion, runtime diagnostics, idempotence, and fail-closed source-contract handling.
- ZIP archive integrity was checked after packaging.

## Runtime limitation
The complete CALLORIA repository was not available for a full Vite build. Vercel deployment and browser rendering were not verified. Eye gaze is available only where deployed static staff GLBs already contain the supported per-eye morph targets.
