# CALLORIA v2.4.2 — Third-Person Player Activation

## Purpose

The current `main` branch contains `build/calloria-third-person-player-plugin.mjs` and `js/world-player-avatar.js`, but the published `vite.config.js` does not import or register that plugin. The avatar code therefore remains inactive in the production build.

This patch registers the existing plugin after the GLB-first workplace plugin and preserves the existing application entry points and all other plugins.

## Install

1. Extract this ZIP.
2. Copy `vite.config.js` to the repository root, replacing the existing file.
3. Copy `tests/third-person-player-activation.test.mjs` into the existing `tests/` folder.
4. Do not replace `main.js`, `production-world.js`, `package.json`, `glb-world-integration.js`, `world-player-avatar.js`, or any GLB asset.
5. Commit the two files to `main` and deploy.

The patch assumes the repository already contains:
- `build/calloria-third-person-player-plugin.mjs`
- `js/world-player-avatar.js`
- `build/calloria-glb-world-plugin.js`
- the current 3D GLB asset registry and loader.

## What changes in the game

When the 3D workplace is entered, the existing player controller remains in control. After GLB staff and office assets are initialised, CALLORIA loads one compatible player model (male agent first, female agent fallback), makes it visible in immersive mode, updates it from the existing player position/yaw on the existing animation loop, follows it with the third-person camera, and disposes it with the world.

If the selected GLB cannot load or fails runtime checks, the existing controller and workplace remain available. It does not create another WebGL renderer or another render loop.

## Verification

Run the existing test suite with `npm test`, then deploy. The included focused test verifies the actual two-plugin transform order against the repository's real `production-world.js` source. A production browser check is still required to confirm model appearance, orientation, camera distance, and mobile controls on the deployed build.
