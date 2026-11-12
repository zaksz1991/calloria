# GitHub installation — CALLORIA v6.22

Replace exactly one production file on the `main` branch:

| Repository path | Action |
|---|---|
| `build/calloria-cc0-staff-glb-bundle-plugin.mjs` | Replace with the file at `build/calloria-cc0-staff-glb-bundle-plugin.mjs` in this ZIP |

Keep the existing Vite plugin registration unchanged. Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/glb-world-integration.js`, `js/production-world.js`, any Supabase configuration, or the `public/assets/models/` directory.

The optional regression test is at `tests/calloria-v622-transform-aware-bounds.test.mjs`. It can be added to the repository's existing `tests/` folder. The test imports the production plugin from `../build/`.

## Vercel verification

Look for log entries beginning with `CALLORIA v6.22`. For each bundled character, the plugin now prints its active-scene world bounds in metres. The bundle summary should also identify how many staff GLBs were structurally compatible.

This patch does not claim an asset rendered merely because validation passed. Confirm the runtime status panel reports the model under `assetsInUse` after deployment.
