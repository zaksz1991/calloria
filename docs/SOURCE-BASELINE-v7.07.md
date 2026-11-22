# Source baseline for CALLORIA v7.07

Inspected current public `main` sources on 22 November 2026.

- `vite.config.js` imports `calloriaGLBWorldPlugin()` first and registers the current gameplay, office, mobile and visitor plugins. The final current plugin entry is `calloriaTryItStudioPlugin()`. The file defines `publicDir: 'public'`, a `dist` output and 21 named build inputs.
- `build/calloria-glb-world-plugin.js` injects the GLB-first workplace bootstrap and calls `createCalloriaGLBHealthPanel({ host, tier })`. Its disposal path calls `glbHealthPanel?.dispose?.()`.
- The transformed world source owns `scene`, `camera`, `renderer`, and `tier` in the `initProductionWorld` scope, so the added diagnostics inspect the existing renderer and scene without creating a second WebGL context.
- `js/glb-asset-health-panel.js` creates panel ID `calloria-glb-health-panel-v682` and content class `.calloria-glb-content`.
- `js/glb-world-integration.js` names staff model wrappers `calloria-glb-staff-<asset-id>-<ordinal>`.
- `js/glb-office-world-integration.js` names office wrappers with `calloria-glb-*` prefixes and records source asset IDs on placed model roots as `userData.calloriaSourceAsset`.
- `js/production-world.js` creates the local Three.js scene, renderer and camera before the GLB-first plugin adds the background GLB integration. The procedural fallback world remains the immediate rendered scene.
- `package.json` defines `preinstall`, `prebuild`, `build`, `postbuild`, `dev`, `preview`, `check` and `test` scripts. Its test script includes `tests/*.test.mjs`.
- `public/privacy.html` exists in the current public `main` snapshot, so the privacy route added in the preceding v7.06 work is present in this source.

The v7.07 post-transform is registered last and uses `enforce: 'post'`, so it sees the source after the GLB-first workplace transform has injected the health-panel state and lifecycle anchors.

## Source references

- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-glb-world-plugin.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/glb-asset-health-panel.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/glb-world-integration.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/glb-office-world-integration.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/production-world.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/package.json
