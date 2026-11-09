# CALLORIA v3.2 — CC0 Reception Lobby Greenery

This is an incremental overlay for the CALLORIA repository after v3.1 (the v3.0 CC0 reception lobby and v3.1 ergonomic workstation-chair integration). It is not a complete CALLORIA repository snapshot.

## What changes

- Adds one real, static CC0 bird-of-paradise clump GLB to the authored reception-lobby planter nodes.
- Uses only planter nodes whose names identify them as planters and whose measured dimensions fit a small lobby planter. It does not scatter plants or invent coordinates.
- Places up to four copies. The plant is 612 triangles, so the maximum added budget is 2,448 triangles.
- Performs the placement before the existing reception GLB static-geometry batching stage, so the foliage uses the lobby's existing batching path.
- Adds `GREENERY: LOADING`, `GREENERY: CC0 GLB` or `GREENERY: FALLBACK` to the existing asset-status line and dispatches `calloria:glb-greenery-ready`.
- Leaves the current lobby scene and its original planters in place when the asset cannot load, validation fails, the lobby has no named planter anchors, or the world is disposed during loading.

## Files

| File | Repository destination | Action |
|---|---|---|
| `js/cc0-lobby-greenery-integration.js` | same path | Add |
| `build/calloria-cc0-lobby-greenery-plugin.mjs` | same path | Add |
| `tests/calloria-cc0-lobby-greenery.test.mjs` | same path | Add |
| `vite.config.js` | same path | Merge the v3.2 plugin import and registration into the current config |

The included `vite.config.js` carries forward the v3.1 baseline. Preserve any later changes in the actual repository when merging it; do not overwrite newer plugin registrations or build inputs.

## Boundaries

- No Supabase migration, Edge Function, secret, auth, payroll, KPI or promotion change.
- No changes to the player controller, staff GLB runtime, workstation operations, shift simulation or existing chair integration.
- No additional npm package or GLB decoder is required.
- The plant GLB loads lazily from the source CDN. The browser needs access to `cdn.3dassets.dev`.
- Existing planters remain visible if a matching named planter anchor cannot be found. This overlay does not fabricate substitute planters or foliage.

## Install through GitHub's web interface

1. Open the CALLORIA repository on the `main` branch.
2. Add the three new files at the exact repository paths listed above, preserving all existing files.
3. Merge the `calloriaCC0LobbyGreeneryPlugin` import and its plugin registration from the supplied `vite.config.js` into the current `vite.config.js`. It must run after `calloriaErgonomicOfficeChairsPlugin()`.
4. Commit the changes. The repository's existing Vercel Git integration will start its normal deployment build.

Do not replace the full repository with this overlay ZIP.
