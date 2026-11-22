# Verification report — CALLORIA v7.18

## Focused tests

- 14 regression tests passed; 0 failed.
- JavaScript syntax checks passed for the new engine, Vite plugin and test file.
- Transformed fixture syntax check passed.
- SLA ordering, bounded ageing, channel filtering, immutable source queue, snapshot counts, deterministic tie-breaking, explanation text, source drift and transform idempotency passed.
- ZIP integrity check passed.

## Scope of verification

Tests use injected queue-sorter and SLA-assessor functions matching the existing application contracts. The Vite transform fixture uses the exact import, queue-sort and SLA-badge anchors observed in public `main` during the source audit.

A full `npm test`, full Vite production build, Vercel deployment, and real-device browser test were not run because a complete checkout of the user's current working branch was not supplied in this turn.

## Known limitation

The patch is designed against the public `main` source snapshot inspected on 22 November 2026. If the local branch has already changed those exact queue-render anchors, the plugin logs a warning and skips the entire transform. It does not partially modify `main.js` or fail the Vite build.
