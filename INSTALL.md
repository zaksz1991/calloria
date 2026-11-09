# CALLORIA v2.5.1 — In-world workstation and third-person activation

## Purpose

The current `main` branch contains the v2.5 workstation experience plugin and the third-person GLB player plugin, but `vite.config.js` does not import or register either plugin. This patch activates both existing modules and preserves the current application entry points and earlier plugin registrations.

## Install

1. Extract this archive.
2. Replace the repository-root `vite.config.js` with the included complete file.
3. Add `tests/calloria-v25-activation.test.mjs` to the existing `tests/` directory.
4. Keep every other repository file unchanged.

Do not replace `main.js`, `production-world.js`, `world-player-avatar.js`, `package.json`, the lockfile, Supabase files, or any original GLB files.

## What the registration order does

- Existing GLB, Meshopt, customer, supervisor and first-shift plugins remain registered.
- `calloriaFirstShiftGameplayPlugin()` emits the events that the workstation experience consumes.
- `calloriaThirdPersonPlayerPlugin()` runs after the GLB-world transform so it can use the transformed GLB-ready, disposal and immersive lifecycle anchors already inserted by that plugin.
- `calloriaWorkstationExperiencePlugin()` runs after the first-shift event bridge and adds the in-world operational console and working/talking clip selection.

## Expected behaviour

- A selected operational view is displayed as an in-world panel while the workplace render loop remains active.
- The player GLB follows the existing movement controller in third-person view when it loads and passes runtime checks.
- Working/talking animations are selected only when compatible clips exist; otherwise the existing idle fallback remains.
- The return-to-game action restores movement without rebuilding the world.

## Validation

Run the repository's existing `npm test` and `npm run build` through the GitHub/Vercel workflow. The included test checks plugin file presence, Vite registration order, and preservation of build entries. This archive has not been tested against a live Vercel deployment.
