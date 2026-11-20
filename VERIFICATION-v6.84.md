# CALLORIA v6.84 — Verification

## Source findings confirmed

The current public `main` source was checked at:

- `build/calloria-glb-world-plugin.js`
- `build/calloria-cc0-staff-glb-bundle-plugin.mjs`
- `js/production-world.js`
- `js/glb-world-integration.js`
- `js/glb-office-world-integration.js`
- `js/glb-asset-health-panel.js`
- `build/calloria-ojt-glb-activation-plugin.mjs`
- `vite.config.js`

The GLB-first world transform awaited staff integration and then office integration before reaching `callbacks.onRenderStatus` and `renderStill()`. The staff integration's validation failures are returned in `status.rejected[]`; the office integration exposes `status.failedAssetIds[]` as well as `status.errors[]`. v6.84 now handles those shapes and does not block the initial render on the GLB jobs.

The existing CC0 bundle post-transform checks for `__CALLORIA_OFFICE_GLB_RUNTIME_V615__`. v6.84 places this marker in the pre-transformed world source because the same pre-transform now performs the office bootstrap itself. The post-transform therefore returns an already-patched result instead of attempting to inject a duplicate bootstrap against an anchor that has already been replaced.

## Automated checks

| Check | Result |
|---|---:|
| Focused GLB path/runtime/diagnostics/startup tests | **32 passed, 0 failed** |
| `node --check` — modified Vite plugin | Passed |
| `node --check` — modified health panel | Passed |
| `node --check` — transformed production-world source snapshot | Passed |
| `node --check` — transformed staff integration fixture | Passed |
| `node --check` — transformed office-anchor fixture | Passed |
| Office post-transform marker compatibility check | Passed; reports already patched |
| ZIP integrity | See `TEST-RESULTS-v6.84.txt` |

The source-transform check used the saved current production-world source snapshot, a staff integration fixture from the earlier GLB runtime package and a minimal office-anchor fixture matching the currently published v6.17 office integration anchors. The current published office source was inspected separately to confirm the exact anchors; the complete current office source was not locally available as a standalone file for a full-file transform test.

## Not verified

- Full repository `npm test` / `npm run build`.
- Vite production bundle and Vercel deployment.
- Network downloads of your deployed GLB files.
- Browser rendering or actual visual placement on a physical Android/iPhone device.
- Whether each asset in the actual `public/assets/` folder meets the current model validation rules.

No production deployment or phone test is claimed. The release is a targeted source overlay, not a full cumulative repository snapshot.
