# GitHub installation — CALLORIA v6.13

In the GitHub repository, make only these two file changes:

| Repository path | Action |
|---|---|
| `js/glb-office-world-integration.js` | Replace with the supplied file |
| `js/glb-office-asset-policy.js` | Add the supplied file |

Keep all existing files, especially:

- `vite.config.js`
- `js/production-world.js`
- `js/glb-world-integration.js`
- `js/glb-asset-registry.js`
- `js/glb-asset-loader.js`
- `js/world-player-avatar.js`
- `js/world-player-avatar-desktop.js`
- all existing `build/` plugins
- the entire `public/assets/models/` folder

The replacement intentionally retains the exact `GLTFLoader`, Meshopt, device-tier plan, headset plan and reception plan anchors used by the existing v2.9/v3.8 transforms. Do not remove or reorder those plugins.

After the deployment, inspect the office GLB status in the 3D workplace. The per-asset report distinguishes a missing file/404, a loader/decoder error, a validation rejection and a placement failure.
