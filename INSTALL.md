# CALLORIA v2.4.1 — Third-Person Player Activation

## Why this update exists

The current `main` branch contains `js/world-player-avatar.js` and `build/calloria-third-person-player-plugin.mjs`, but `vite.config.js` does not import or register `calloriaThirdPersonPlayerPlugin()`. As a result, the third-person GLB player transform is not included in the Vite build.

This is a narrow activation patch. It registers the existing plugin after the other configured plugins. The plugin itself uses `enforce: 'post'`, so it receives the production-world module after the existing `enforce: 'pre'` GLB world transform has added the combined GLB-ready callback, mission disposal hook, and immersive event.

## Install

1. Extract this ZIP.
2. Copy the included `vite.config.js` to the repository root, replacing the existing file.
3. Copy `tests/third-person-player-activation.test.mjs` into the existing `tests/` directory.
4. Commit both files to `main`.

Do not replace `package.json`, `js/main.js`, `js/production-world.js`, `js/world-player-avatar.js`, `build/calloria-third-person-player-plugin.mjs`, or any GLB models.

## What this activates

- The existing male/female GLB player-avatar loader.
- Avatar updates from the existing player movement loop.
- A third-person follow camera while the 3D workplace is immersive.
- Avatar visibility changes on enter/exit.
- Avatar disposal with the existing world lifecycle.
- Existing Meshopt decoding through the current player loader.

## Verification boundary

The included contract tests verify the source registration and expected source hooks. They do not prove that a specific binary GLB passes runtime inspection on a phone. A full Vercel build and browser check remain necessary after commit.
