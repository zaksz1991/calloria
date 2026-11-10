# CALLORIA v3.8.1 verification

The focused patch suite currently contains 12 passing tests. The patch tests are designed around the current committed source shape, including the unconfigured staff loader, the office Meshopt-only loader and the shared loader constructor without a decoder setup.

Checks to run in the merged repository:

- `npm test` — full repository suite (not run here because the complete repository checkout was not available).
- `npm run build` — full Vite production build (not run here).
- Inspect built `dist/draco/` for all three decoder assets.
- Open the deployed 3D floor and inspect the `3D ASSET STATUS` panel.
- Verify non-zero `staffLoaded` and `officePlaced` counts before reporting actual GLB use.
- Confirm no oversize player mesh appears and inspect any rejected-model reasons.

Patch-workspace checks are reported in the accompanying session log; they do not establish full Vercel build success, live rendering or phone performance.
