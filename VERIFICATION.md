# Verification — CALLORIA v6.32

## Automated checks
- 69/69 Node regression tests passed across all carried-forward staff GLB tests and the new v6.32 eye-blink tests.
- Replacement build plugin passed `node --check`.
- A transformed v1.2 staff-runtime fixture passed `node --check` after the new morph-target integration was generated.
- Tests cover morph-name matching, index guards, neutral influence preservation, staggered timing, authored-animation isolation, diagnostics, tier scheduling, idempotence and fail-closed behaviour.
- No additional renderer or animation loop introduced.
- ZIP archive integrity checked after packaging.

## Runtime limitation
The complete CALLORIA repository and production Vercel deployment were not available for a full Vite build in this patch operation. Browser rendering was not performed. Blink motion is conditional on the deployed GLB containing a recognised eye-blink morph target; diagnostics expose the number of targets actually bound.
