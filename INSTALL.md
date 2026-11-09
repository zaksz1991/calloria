# CALLORIA v2.4 — Third-person GLB Player Character

## Purpose

This upgrade gives the player a visible agent character using the existing `male-agent.glb` and `female-agent.glb` assets. The camera follows behind the character while the existing joystick, drag-to-look, sprint and USE controls remain in place. It does not replace `production-world.js` or `main.js`.

The avatar loader accepts a valid static mesh or skinned GLB. It uses embedded idle/walk/run clips when present. Models without clips remain real GLB geometry and receive only a restrained whole-object movement cue; no fake skeleton is generated. If neither character loads or passes checks, the existing first-person controller remains active.

## Files

- Add `js/world-player-avatar.js`
- Add `build/calloria-third-person-player-plugin.js`
- Add `tests/third-person-player.test.mjs`
- Replace root `vite.config.js` with the complete file supplied in this package.

Do not replace `main.js`, `production-world.js`, `package.json`, `package-lock.json`, Supabase files or any original GLB assets.

## Expected visible result

When the user enters the 3D floor, the camera should follow behind a visible agent GLB. The left joystick continues to move the character; dragging the right/central scene changes facing direction; sprint remains available; USE still activates when a workstation is in range. If a GLB cannot be loaded, status is reported and the previous camera/controller is retained.

## Tests

Run the included Node test file with the repository's existing test runner. This package does not add dependencies or change the package manifest.

## Verification boundary

The package's contract tests and JavaScript syntax can be checked independently. A full Vercel build and actual mobile rendering still require deployment against the current repository. The model's actual in-game orientation and available animation clips must be confirmed in the browser; the avatar loader reports those facts through `calloria:player-avatar-ready` and the `assetStatus` line.
