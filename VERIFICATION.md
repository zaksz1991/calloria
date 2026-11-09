# Verification boundary

Checked against the publicly accessible `main` source files on 2026-11-09:

- `vite.config.js` had the GLB, Meshopt, customer, supervisor and first-shift plugins registered, but lacked registrations for the existing third-person player and v2.5 workstation experience plugins.
- `build/calloria-third-person-player-plugin.mjs` expects anchors inserted by `calloriaGLBWorldPlugin()` (`combinedAssetStatus`, mission-layer disposal and immersive-state event), so it must run after the GLB-world transform.
- `build/calloria-workstation-experience-plugin.mjs` expects the `calloria:game-operation-selected` event inserted by the first-shift bridge, so it must be registered after `calloriaFirstShiftGameplayPlugin()`.
- The replacement Vite configuration preserves all previous imports, entry points, publicDir, Three.js chunking, and server/preview settings.

Not verified here: full dependency install, `npm test` against the complete repository, Vercel production build, or actual mobile WebGL rendering. Those require running against the user's complete repository and deployment.
