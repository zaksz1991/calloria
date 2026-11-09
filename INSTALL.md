# Installation — CALLORIA v3.3

## Required baseline

The active `main` branch must already include the v3.2 greenery integration, the v3.2 plugin in Vite, Three.js, and `js/glb-asset-loader.js` with `disposeGLTFResources`.

## Add

- `js/cc0-glazed-department-partitions.js`
- `build/calloria-glazed-department-partitions-plugin.mjs`
- `tests/calloria-glazed-department-partitions.test.mjs`

## Merge the Vite registration

Add:

```js
import { calloriaGlazedDepartmentPartitionsPlugin } from './build/calloria-glazed-department-partitions-plugin.mjs';
```

Register after greenery:

```js
calloriaCC0LobbyGreeneryPlugin(),
calloriaGlazedDepartmentPartitionsPlugin()
```

The supplied `vite.config.js` is the v3.2 baseline plus this new plugin. Keep newer local settings, HTML inputs and plugin registrations when merging.

## Runtime and fallback behaviour

The integration verifies the three existing named panes (`qa-glass-front`, `supervisor-left-glass`, `supervisor-right-glass`) against their expected dimensions before requesting the asset. It validates the loaded model against the published 1.2 × 2.6 × 0.08 m envelope and geometry limits.

Only after the selected tier's complete set of module clones has been prepared does the code add them to the scene and hide the corresponding original panes. On any fetch, validation, placement or lifecycle failure, the original panes remain or are restored.

Low tier uses six QA modules only (3,384 triangles). Balanced/high use all 16 modules (9,024 triangles). The model is visual only; it does not modify collision logic or block any doorway.
