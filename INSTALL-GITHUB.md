# CALLORIA v6.18 — Lobby Greenery Runtime Activation

This is a four-file overlay. It does not replace the package manifest, lockfile, Vite configuration, production-world module, or any shared service credentials.

## Replace these existing files

- `js/cc0-office-lobby-integration.js`
- `build/calloria-cc0-lobby-greenery-plugin.mjs`

## Add or replace this asset integration file

- `js/cc0-lobby-greenery-integration.js`

## Add this verification file

- `tests/lobby-greenery-runtime.test.mjs`

## Preserve the rest of the repository

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/production-world.js`, `js/glb-office-world-integration.js`, the staff GLB files, or the shared Supabase/Groq configuration.

The existing Vite config still imports and invokes `calloriaCC0LobbyGreeneryPlugin()`. The replacement plugin deliberately returns no transform because greenery is now called directly inside the current lobby GLB lifecycle. This removes the obsolete v3.2 source-anchor transformation that previously skipped the updated lobby integration.

## Runtime behavior

- Uses the documented CC0 bird-of-paradise GLB.
- Plants are added only to named planter anchors found and validated in the loaded reception-lobby GLB. It does not invent placement coordinates.
- If no qualifying planter anchors exist, or the external asset fails validation/loading, the lobby remains intact and its greenery status reports the reason.
- Greenery resources are released with the lobby layer; the existing lobby fallback and disposal behavior are retained.
- The integration emits `calloria:glb-greenery-ready` and includes a `greenery` status object in the lobby status payload.

This package was tested with focused Node contract tests and syntax checks. It was not tested with the full repository's Vite production build or a deployed browser session.
