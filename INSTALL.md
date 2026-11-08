# CALLORIA First-Shift GLB Activation v2.2

## Purpose

Activate the office GLB module and first-shift objective system against the
current `main` source contract without replacing `main.js`, `production-world.js`,
`package.json`, `vite.config.js`, or the GLB assets.

## Files in this package

Replace:
- `build/calloria-glb-world-plugin.js`
- `js/world-gameplay-mission.js`

Add:
- `tests/calloria-first-shift-activation.test.mjs`

## Existing repository dependencies

This upgrade expects the following files already present on `main`:
- `js/glb-world-integration.js`
- `js/glb-office-world-integration.js`
- `js/glb-asset-registry.js`
- `js/glb-asset-loader.js`
- `js/glb-character-motion.js`

The repository's existing `vite.config.js` already imports and registers
`calloriaGLBWorldPlugin()`. Do not add a duplicate plugin registration.

## What changes in the game

1. The currently committed office GLB loader is invoked alongside the staff
   GLB loader and receives the actual Three.js scene, station catalogue and
   device tier.
2. Office GLB failures are isolated. They do not stop the world from loading;
   the original scene objects remain available as fallbacks.
3. The player starts at the approach point for Agent Station 11. This station
   is included in the existing low, balanced and high office asset plans.
4. The existing `USE` action emits the workstation-access event used by the
   first-shift objective overlay.
5. The objective card explains the sequence: approach station, open the
   workstation, choose an operation.
6. The existing render loop updates staff and office layers. No second
   WebGLRenderer or animation loop is created.
7. The graphics status reports staff GLB count and office GLB object count
   separately; it no longer describes procedural local staff as GLB assets.

## Installation

Merge the three package files into the matching paths in the repository.
Commit the two replacements and one test file to `main`.

Do not replace any other files.

## Verification

The included focused tests exercise the actual transform contract used by the
plugin: imports, office and staff activation, station spawn, event bridges,
lifecycle cleanup, duplicate protection and fail-closed source anchors.

The tests do not claim that Vercel deployment or browser rendering has been
completed. Those require a production build and mobile browser check.
