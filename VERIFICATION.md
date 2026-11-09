# CALLORIA v3.3 verification

Package-workspace verification:

- Focused Node tests: 9/9 passed.
- `node --check` on all JavaScript modules, Vite config and tests: passed.
- ZIP integrity: passed.
- Source-transform tests cover v3.2 baseline gating, exact source anchors, idempotence, unrelated-file isolation, async load lifecycle, disposal, status exposure and Vite plugin order.
- Static source tests cover the published CC0 asset URL, geometry budget, tier limits, exact anchor names and restoration fallback.

Not performed here:

- Full CALLORIA repository `npm test` or production `npm run build`.
- Live CDN fetch inside the user's deployed browser.
- Visual inspection of panel centring, scene lighting, alpha sorting or actual fit in the running game.
- Device-tier FPS testing on a physical phone.

The package does not claim that the deployed 3D scene has been visually verified. The exact model dimensions and published triangle/material counts are from the asset publisher's record.
