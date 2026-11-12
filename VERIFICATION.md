# Verification — CALLORIA v6.33

## Automated checks
- The full carried-forward Node regression suite plus v6.33 tests passed.
- Replacement build plugin passed `node --check`.
- The transformed v1.2 staff-runtime fixture passed syntax validation.
- Tests verify the generalized static-model traversal gate, morph scan ordering, unskinned static-mesh support, animated-model exclusion, morph-index guards, tier scheduling, idempotence and fail-closed behaviour.
- ZIP archive integrity was checked after packaging.

## Runtime limitation
The complete CALLORIA repository was not available for a full Vite build. Browser rendering and deployed Vercel behaviour were not verified. The update activates morph targets already present in GLBs; it does not add facial geometry.
