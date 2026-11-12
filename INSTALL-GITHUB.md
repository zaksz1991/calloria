# GitHub installation — CALLORIA v6.20

Prerequisite: v6.19 Department Glass Runtime Activation and its v6.18/v6.17.1 prerequisites must already be installed. Apply this ZIP as an overlay on `main`.

## Replace these files

1. `js/cc0-office-lobby-integration.js`
2. `js/cc0-glazed-department-partitions.js`

## Add these files

3. `js/calloria-glass-material-policy.js`
4. `js/calloria-lobby-lighting-policy.js`

Optional test file:

5. `tests/office-visual-finish.test.mjs`

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/production-world.js`, `js/glb-asset-loader.js`, `js/cc0-lobby-greenery-integration.js`, `js/cc0-office-lobby-policy.js`, any asset under `public/assets/models/`, or any Supabase/Groq setting.

Upload/replace the files at those exact repository paths through GitHub's web interface and commit to `main`.
