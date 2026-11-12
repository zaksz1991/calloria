# GitHub installation — CALLORIA v6.16

Make exactly three production-file changes on the `main` branch.

| Repository path | Action |
|---|---|
| `js/glb-office-world-integration.js` | Replace with the v6.16 file |
| `js/cc0-office-chair-integration.js` | Add new file |
| `js/office-chair-policy.js` | Add new file |

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `production-world.js`, the v6.14 staff GLB plugin or any v6.10–v6.15 mobile/assessment files.

Keep these existing runtime dependencies unchanged:

- `js/glb-asset-registry.js`
- `js/glb-asset-loader.js`
- `js/glb-office-asset-policy.js`
- `js/glb-office-draco-policy.js`
- `js/glb-world-integration.js`
- `js/production-world.js`
- `build/calloria-cc0-staff-glb-bundle-plugin.mjs`
- `public/assets/models/`

## GitHub web interface

1. Open `github.com/zaksz1991/calloria` and select the `main` branch.
2. Open `js/glb-office-world-integration.js`, choose **Edit**, replace its contents with the matching v6.16 file, then save the change.
3. Use **Add file → Create new file** to add `js/cc0-office-chair-integration.js` with the matching file contents.
4. Repeat to add `js/office-chair-policy.js`.
5. Keep the three changes on `main`. No Vite configuration edit is needed.

## Deployment checks

After Vercel finishes building, open:

`https://calloria.vercel.app/office-floor.html`

The existing office status event should now include `chairFurniture` with:

- `loaded: true`
- `chairsPlaced: 2`, `4` or `8`, depending on graphics tier
- `stationIds`
- `mergedDrawCalls`
- `license: CC0 1.0 Universal`

The main office status should also include `3dassets-office-task-chair` under `assets` and `loadedAssetIds` when successful.

If the external model cannot load, `chairFurniture.reason` identifies the failure and the original workstation chairs remain visible. Do not interpret a build success alone as proof that the chair GLB rendered.
