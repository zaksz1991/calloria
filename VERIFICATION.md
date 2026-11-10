# CALLORIA v3.7.2 verification

## Checks run in the patch workspace

- `node --check build/calloria-ojt-glb-activation-plugin.mjs`: passed.
- `node --test tests/calloria-v37-onboarding-glb.test.mjs`: **10 passed, 0 failed**.
- ZIP integrity: checked after packaging.

## Regression coverage

- Office loader receives Draco while retaining Meshopt.
- The office transform accepts the expanded v2.9 plan produced by the earlier `enforce: "pre"` plugin.
- The office transform also accepts the original plan shape.
- The upstream station and headset selections remain unchanged.
- Existing staff-loader, shared asset-loader, low-tier staff placement, first-person, OJT, briefing and HTML HUD checks remain present.

## Not verified

- Full repository `npm test` (the complete repository checkout is not present in this patch workspace).
- Full Vite production build against the user's exact GitHub checkout.
- Vercel deployment.
- Browser network loading/rendering of each GLB, skeleton deformation or animation.
- Android visual inspection and device performance.

This patch fixes the exact anchor mismatch from the supplied Vercel log. It does not claim that the complete application build or runtime GLB rendering is now verified.
