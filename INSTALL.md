# Installation — CALLORIA v3.2

## Required baseline

The active CALLORIA `main` branch must already include:
- v3.0 `js/cc0-office-lobby-integration.js` and its production-world plugin integration;
- v3.1 `js/cc0-office-chair-integration.js` and `calloriaErgonomicOfficeChairsPlugin()`;
- the existing `three` dependency and `js/glb-asset-loader.js` disposal helper.

## Add these files

- `js/cc0-lobby-greenery-integration.js`
- `build/calloria-cc0-lobby-greenery-plugin.mjs`
- `tests/calloria-cc0-lobby-greenery.test.mjs`

## Update Vite registration

Merge the following import into the current `vite.config.js`:

```js
import { calloriaCC0LobbyGreeneryPlugin } from './build/calloria-cc0-lobby-greenery-plugin.mjs';
```

Register it immediately after the existing chair plugin:

```js
calloriaErgonomicOfficeChairsPlugin(),
calloriaCC0LobbyGreeneryPlugin()
```

Keep all other plugins, HTML build inputs, aliases, build settings and later project-specific additions. The supplied `vite.config.js` is a v3.1-derived reference, not permission to discard changes made after v3.1.

## Runtime behaviour

The greenery module loads the plant GLB only after the reception lobby GLB passes its existing geometry validation. It searches the lobby scene for named planter nodes, checks their bounding boxes, and only then places plants. If no suitable anchor exists, the external asset fails, or its geometry fails validation, the lobby still loads without added greenery. The overlay does not modify the underlying authored planter meshes.

The plugin patches the lobby integration and the already-v3.1-transformed production-world module using exact source anchors. If the source has drifted, it warns and skips the affected transform rather than applying a partial text replacement.

No Supabase dashboard, SQL editor, Edge Function deployment, environment variable, account map or secret change is part of this phase.
