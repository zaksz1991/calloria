# Reading the next CALLORIA build and runtime result

This release changes browser-side decoding, not the build-time staff model validator. The existing `4/5 structurally compatible` staff count is unaffected.

For office assets, look at the runtime `calloria:office-glb-status` report:

- `errorCategory: draco-decoder`: decoder script/WASM could not load or the Draco extension could not be decoded.
- `errorCategory: http-or-network`: registry URL, response, network or CORS problem.
- `errorCategory: glb-parse`: GLB/chunk/extension parse problem.
- `errorCategory: validation`: loaded model did not meet the office geometry or texture policy.
- `errorCategory: placement`: validated model could not be fitted/placed in the scene.
- `placementStatus: placed` with `placementCount`: actual visible Three.js object additions.

A successful npm/Vite build only confirms that the modules bundle. It does not prove browser assets loaded. The panel/event must show non-zero `officeObjectsPlaced` and per-model `placementStatus: placed` to claim runtime placement.
