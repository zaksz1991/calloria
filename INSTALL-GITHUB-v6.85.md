# CALLORIA v6.85 — Third-person transform compatibility repair

**Repository:** `zaksz1991/calloria`  
**Baseline inspected:** commit `393dbd9`  
**Production site:** `https://calloria.vercel.app`  
**Release type:** targeted source overlay; not a complete repository snapshot

## Apply the repair

1. Back up the current CALLORIA repository.
2. Extract this ZIP.
3. Open the existing repository in GitHub Desktop and select **Repository → Show in Explorer**.
4. In the extracted release folder, copy `build/calloria-third-person-player-plugin.mjs` into the matching `build` folder in the repository, replacing the existing file.
5. Copy the supplied `tests` folder into the repository's existing `tests` folder. Merge the files; do not delete existing tests.
6. Do not change `vite.config.js`. The plugin is already imported and registered there.
7. Preserve `.git`, `public/assets/`, all GLB binaries, `.env` files, Supabase settings, and every unrelated project file.
8. Review the changed-file list. Commit with the message:

   `CALLORIA v6.85 — fix third-person world transform`

9. Push to `main` and review the new Vercel deployment log.

## What this changes

The previous third-person plugin required the exact string `callbacks.onAssetsReady?.(combinedAssetStatus);` and two other implementation-specific anchors. The current `production-world.js` source uses a local-world asset callback and an `onRenderStatus`/`renderStill` first-render sequence. The previous strict anchor check therefore stopped Vite before the build could complete.

The replacement plugin supports both the current local-world source and the v6.84 GLB-transformed source. It attaches to the stable first-render callback, keeps avatar loading asynchronous, supports both disposal shapes and both immersive-state event shapes, and remains idempotent.

On touch devices it deliberately keeps first-person view and does not start a separate player-avatar GLB download. On desktop, it starts the avatar GLB after the initial world render, not during world initialization. The fallback controller remains usable when the model is missing or rejected.

## Files

| File | Action |
|---|---|
| `build/calloria-third-person-player-plugin.mjs` | Replace existing plugin |
| `tests/calloria-third-person-current-world-v685.test.mjs` | Add regression tests |
| `tests/fixtures/production-world-current-snapshot.js` | Test fixture for the current local-world structure |
| `tests/fixtures/production-world-after-v684.js` | Test fixture for the v6.84-transformed structure |

No new dependency, environment variable, Supabase migration, Edge Function, or Vite plugin registration is introduced.
