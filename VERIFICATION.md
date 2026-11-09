# Verification — CALLORIA v3.2

## Completed checks

- 12/12 focused Node regression tests passed.
- JavaScript syntax checks passed for the new browser module, Vite plugin, Vite config and regression tests.
- The lobby transform was run against the complete v3.0 lobby integration source and applied successfully with no anchor warnings.
- Synthetic v3.1 production-world fixtures verified the loading, loaded and fallback status updates.
- Fail-closed behaviour, idempotence, disposal paths, source metadata, triangle limits and Vite plugin order were tested.
- ZIP archive integrity was checked after packaging.

## Not verified in this workspace

- The complete CALLORIA repository was not available as a checkout, so its full production build and complete pre-existing test suite were not run.
- The browser did not load the two external GLBs here. Exact planter node names, visible placement, plant scale and seat/foliage overlap still require validation in the deployed 3D reception view.
- Because placement is anchor-based, a source GLB that does not expose matching named planter nodes will show `GREENERY: FALLBACK` and retain the original lobby unchanged.

The test results above are focused overlay checks; they are not a claim of successful live rendering or a full production deployment.
