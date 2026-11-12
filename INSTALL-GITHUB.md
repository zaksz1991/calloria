# Install CALLORIA v6.19 — GitHub web interface

Prerequisite: CALLORIA v6.18 Lobby Greenery Runtime Activation must already be installed. Apply this ZIP as an overlay on the repository's `main` branch.

## Replace these files

1. `js/cc0-office-lobby-integration.js`
2. `build/calloria-glazed-department-partitions-plugin.mjs`

## Add or replace this file

3. `js/cc0-glazed-department-partitions.js`

## Preserve all other files

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/production-world.js`, `js/cc0-lobby-greenery-integration.js`, `js/glb-asset-loader.js`, Supabase settings, Groq keys, or any GLB assets.

## GitHub steps

1. Open the CALLORIA repository on GitHub.
2. Open each listed path and use the edit/upload controls to replace the file with the matching file from this ZIP. Create the `js/cc0-glazed-department-partitions.js` file if it does not already exist.
3. Commit the three-file overlay to `main`.
4. Allow Vercel to deploy the commit.

This package intentionally leaves `vite.config.js` untouched. Its existing plugin import remains valid; the plugin no longer rewrites `production-world.js` using stale text anchors.
