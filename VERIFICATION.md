# CALLORIA v3.5 verification record

## Completed in the patch workspace

| Check | Result | Boundary |
|---|---|---|
| v3.5 plugin syntax check | Pass | Node syntax validation only. |
| third-person plugin syntax check | Pass | Node syntax validation only. |
| Vite configuration syntax check | Pass | Does not load or execute Vite. |
| regression test syntax check | Pass | Node syntax validation only. |
| focused v3.5 regression tests | **10 passed, 0 failed** | Tests exercise source transforms against fixtures reflecting the inspected current source anchors. |
| transformed staff fixture parse | Pass | Checks generated JS syntax for the staff transform. |
| transformed avatar fixture parse | Pass | Checks generated JS syntax for the avatar transform. |
| transformed main fixture parse | Pass | Checks generated JS syntax for the main transform. |
| ZIP integrity | Pass | Archive can be opened and tested. |

## Not run / not verified

- The complete repository `npm test` suite.
- `npm run build` or the full Vite production bundle. This patch workspace does not include the complete CALLORIA repository or its installed `three`/Vite dependencies.
- Decoder assets resolved from the deployed dependency installation.
- Browser-side GLB loads, CORS, animation playback or visual fidelity.
- The complete gameplay sequence on `calloria.vercel.app`.
- Android/iOS physical-device testing, frame rate, touch usability or responsive layout.
- GitHub commit, Vercel deployment, live database or production data changes.

## Important interpretation

The 10 passing tests demonstrate that the patch transforms the source fixtures and that the emitted JavaScript parses. They do not establish that the current production assets will load, that staff geometry will look professional, or that a complete agent shift works end to end.

The screenshots' `0 STAFF` and `2 LOAD ERRORS` problem can have causes beyond decoder compatibility, including unavailable files, CORS, unsupported extensions, invalid GLB data or asset metadata. v3.5 adds more actionable rejection information but does not fabricate a successful asset load.
