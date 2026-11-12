# v6.16 verification

| Check | Result |
|---|---:|
| Focused policy / runtime / regression tests | 21 passed, 0 failed |
| JavaScript syntax (`node --check`) | Passed for all shipped runtime and test modules |
| Chair tier selection | Passed |
| Geometry and total-triangle budgets | Passed |
| Fallback visibility / restoration contracts | Passed |
| Draw-call batching contract | Passed |
| v6.15 Draco + Meshopt regression contracts | Passed |
| ZIP integrity | Passed |

## Not verified

- A full Vite production build against the current GitHub `main` branch.
- Runtime download of the 3DAssets.dev GLB from a deployed browser.
- Actual 3D placement and Android rendering.

The source GLB was not downloaded in this workspace. The implementation retains existing fallback chair geometry if the external GLB cannot be fetched or fails validation. The 21 tests are focused policy and source-contract tests, not a complete browser integration suite.
