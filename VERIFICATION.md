# v6.17 Verification

## Performed

- `node --check js/glb-office-world-integration.js` — passed.
- `node --check js/cc0-office-lobby-integration.js` — passed.
- `node --check js/cc0-office-lobby-policy.js` — passed.
- `node --test tests/*.test.mjs` — 16 passed, 0 failed.
- ZIP integrity (`unzip -t`) — passed after packaging.

## Focused coverage

- CC0 asset ID, URL and licence metadata.
- Low/balanced/high graphics-tier gating.
- Valid published geometry envelope.
- Invalid/missing metrics, dimension, triangle, mesh, material and texture rejection.
- Procedural fallback object inventory.
- Existing-loader integration into the active Three.js scene.
- Full lobby attempt before standalone reception-desk fallback.
- Fallback hidden only after successful scene placement.
- Fallback visibility restoration and GLTF/generated-geometry disposal.
- No second renderer or animation loop.
- Lobby diagnostics and office placement aggregation.
- Existing v6.16 desk, computer, headset, ergonomic chair, Draco and Meshopt paths remain wired.

## Not performed

- No full `npm run build` was run because this workspace does not contain the user's current full repository and package installation.
- No Vercel deployment was performed.
- The live CDN GLB was not fetched in this verification run.
- No real Android phone or in-browser visual rendering was performed.

## Known runtime dependency

The complete lobby depends on the publisher CDN and CORS. If it fails, the runtime retains fallback reception assets. The low graphics tier intentionally skips the full lobby model.
