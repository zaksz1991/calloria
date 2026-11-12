# Verification — CALLORIA v6.34

## Automated checks
- Carried-forward Node regression suite plus v6.34 facial-expression tests passed.
- Replacement build plugin passed `node --check`.
- Transformed staff runtime fixture passed syntax validation.
- Tests cover the static-model gate, strict smile/dimple and brow allow-lists, morph-index and influence bounds, asynchronous expression envelope, authored-animation exclusion, diagnostics, idempotence, and fail-closed contract handling.
- ZIP archive integrity was checked after packaging.

## Runtime limitation
The complete CALLORIA repository was not available for a full Vite build. Vercel deployment and browser rendering were not verified. Facial movement is available only where deployed staff GLBs already contain supported morph targets.
