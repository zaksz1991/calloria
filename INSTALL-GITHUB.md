# GitHub installation — CALLORIA v6.15

In `github.com/zaksz1991/calloria`, make only these changes:

| Repository path | Action |
|---|---|
| `js/glb-office-world-integration.js` | Replace with this package's file |
| `js/glb-office-draco-policy.js` | Add this file |

Do not replace `package.json`, `package-lock.json`, `vite.config.js`, `build/calloria-glb-world-plugin.js`, `js/production-world.js`, `js/glb-office-asset-policy.js`, the v6.14 staff bundle plugin, or any GLB assets.

The default decoder is loaded from the pinned Google-hosted DRACO 1.5.7 decoder path only when the loader encounters Draco-compressed geometry. If the application later self-hosts those decoder files, set `window.CALLORIA_DRACO_DECODER_PATH` to that folder before the 3D world is initialized.

After deployment, open the 3D workplace and inspect the GLB status panel. Failed models now include a category and retain their registry path and URL. Check `assetDetails` in the `calloria:office-glb-status` event for exact per-model results.
