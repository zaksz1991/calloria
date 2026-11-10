# CALLORIA v3.9.0 — GitHub Desktop installation

## Baseline

This is a patch for the current `zaksz1991/calloria` main branch after the v3.8.2 runtime syntax repair. It preserves the existing Vite multi-page configuration and plugin chain, adding only the CC0 staff GLB bundle plugin.

## Files

| ZIP path | Repository path | Action |
|---|---|---|
| `build/calloria-cc0-staff-glb-bundle-plugin.mjs` | same path | Add new file |
| `vite.config.js` | `vite.config.js` | Replace completely with the included merged configuration |
| `tests/calloria-v39-cc0-staff-glb.test.mjs` | same path | Add new file |
| `README.md`, `INSTALL-GITHUB.md`, `CHANGELOG.md`, `VERIFICATION.md`, `CC0-ASSET-PROVENANCE.md` | ZIP documentation | Reference only; do not overwrite repository documentation |

No `package.json`, `package-lock.json`, `main.js`, `index.html`, `glb-world-integration.js`, `glb-asset-registry.js`, `production-world.js`, model binaries, or Supabase files are replaced.

## GUI installation

1. Extract the ZIP in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the new `build/calloria-cc0-staff-glb-bundle-plugin.mjs` into the repository's `build` folder.
5. Replace the repository's `vite.config.js` with the complete included file. This file was reconstructed from the current public `main` Vite configuration and adds one plugin import plus one plugin registration. Keep the OJT plugin last.
6. Copy the new test file into `tests`.
7. Keep the package README, installation guide, changelog and verification report as reference documents; do not overwrite the repository README or existing project documentation.
8. Review the GitHub Desktop changed-file list. It should include the new plugin, the merged Vite config and the new test. Keep the package documentation as reference.
9. Commit with: `CALLORIA v3.9.0 — bundle CC0 rigged staff GLBs`.
10. Push to `main` and inspect the Vercel build log.

## Vercel build expectations

The plugin uses Node's built-in `fetch`; no npm dependency or environment secret is required. During `buildStart`, it makes up to two attempts per direct asset URL, with a 15-second request timeout, in a three-worker pool. Five successful model files are capped at 8 MiB each and 36 MiB total.

Expected build log entries include:

- `CALLORIA v3.9 bundled OfficeLady ...`
- `CALLORIA v3.9 bundled Accountant ...`
- `CALLORIA v3.9 staff GLB bundle: N/5 validated ...`

If a source is unreachable or the file fails validation, Vite logs a warning and writes the exact failure into the public manifest. The build itself is not intentionally failed by a temporary asset-host outage.

## Post-deployment checks

Open `/assets/models/calloria-cc0-staff-manifest.json` on the deployed site. Then enter the 3D world and verify actual `GLB STAFF` replacements. Do not mark the GLB milestone complete solely because a manifest exists or the download succeeded.
