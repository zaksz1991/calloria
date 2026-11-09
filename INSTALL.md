# CALLORIA First-Shift Build Fix v2.3.1

## Build failure addressed

The v2.3 Vite plugin searched `js/main.js` for this string:

`if(failureCount)console.warn('CALLORIA GLB asset loading details:',result.furnitureErrors);`

That line is not present in `main.js`. Furniture and office GLB status are assembled inside the `production-world.js` integration. `main.js` exposes the real `onAssetsReady:result=>{...}` callback instead.

The missing telemetry anchor caused Vite to stop with:

`expected exactly one GLB asset status telemetry anchor (0 found)`

## Installation

In the CALLORIA repository, replace only:

`build/calloria-first-shift-gameplay-plugin.js`

Add the updated regression test:

`tests/calloria-first-shift-gameplay.test.mjs`

Do not replace `vite.config.js`, `main.js`, `production-world.js`, `package.json`, lockfiles, or any GLB assets. The existing Vite plugin registration is already correct.

## What the fix changes

- Keeps the existing recruitment, briefing, shift, customer-call, case-save and workstation event bridges.
- Moves GLB telemetry injection to the real `onAssetsReady` callback in `main.js`.
- Reads the actual combined fields supplied by the GLB-first production-world integration: `staffLoaded`, `officePlaced`, `officeErrors`, `rejected`, and `tier`.
- Emits `calloria:glb-assets-ready` for the existing first-shift mission HUD.
- Reports zero GLB objects honestly; it no longer labels local procedural staff as loaded 3D staff.
- Preserves strict checks for all eight source anchors and refuses partial transformation.
- Does not alter application business logic or mutate `main.js` on disk. The change is applied by Vite at build time.

## Verification

The included tests cover mission progression, GLB status, telemetry callback transformation, plugin idempotence, and plugin registration. Run the repository's existing `npm test` and `npm run build` after merging.
