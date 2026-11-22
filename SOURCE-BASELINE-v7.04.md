# CALLORIA v7.04 source baseline

Audited against the public `main` branch during preparation:

- `package.json`: minimal manifest with only a `test` script; no `build` script or application dependencies.
- `.nvmrc`: `22.16.0`.
- `vercel.json`: install command `npm install`, build command `npm run build`, output directory `dist`.
- `vite.config.js`: imports the existing local plugins and declares a multi-page Rollup build, with a dedicated chat-widget entry. The third-person player plugin is already registered; no new registration is required.
- `js/production-world.js`: has the render-ready callback followed by `renderStill()`, an `updatePlayer(delta)` animation-loop call, an immersive-state callback and the current world disposal block.
- `build/calloria-glb-world-plugin.js`: runs as a Vite `pre` transform and changes the disposal block to add GLB/mission cleanup plus a public immersive event.
- `build/calloria-third-person-player-plugin.mjs`: current v2.6 plugin runs as `enforce: 'post'` and already supports the render-ready, update-loop, disposal and immersive contracts. Its source-anchor failures use fatal `context.error()`, which v7.04 changes to a prevalidated warning-and-skip contract while preserving the runtime logic.
- `tools/calloria-build-preflight.mjs` and `tools/calloria-build-artifact-audit.mjs` already exist on public `main`; v7.04 updates the preflight to validate the stricter npm policy, optional avatar plugin contract and Vercel build contract.

This is an overlay based on current public source, not a full local repository checkout. Full multi-page Vite compilation, GitHub Actions execution and Vercel deployment were not available for verification in the preparation environment.
