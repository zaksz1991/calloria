# CALLORIA v6.84 — Non-blocking 3D workplace and GLB startup

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release type:** targeted source overlay; not a full repository snapshot  
**Baseline:** current v6.83 GLB diagnostics consolidation + the v6.82/v6.81 runtime modules

## What this release fixes

The previous GLB-first Vite transform awaited the staff GLB integration and then the office GLB integration inside `initProductionWorld()`. Those operations include network requests, parsing, validation and placement. The world-ready callback, first render and return from the initializer sat after both awaited operations. A slow or blocked model request could therefore delay the visible workplace and its touch controls on a phone.

v6.84 changes the ordering:

1. Keep the local procedural workplace and fallback staff/furniture as the immediately available scene.
2. Create the collapsed GLB status panel and first-shift overlay without waiting for model requests.
3. Run the original render-ready callback and first still render.
4. Schedule GLB startup in the browser's idle queue, with a 1.2-second maximum idle wait; browsers without `requestIdleCallback` use a 220 ms timeout.
5. Start staff and office asset integrations independently and concurrently. Each completion updates its own status; one failed asset family does not block the other.
6. Cancel a not-yet-started idle callback/timer when the world is disposed. Dispose any GLB layer that resolves after disposal.

The status report now distinguishes **pending** from **settled with zero placements**. It also reads the staff integration's `rejected[]` records and the office integration's `failedAssetIds[]`, which the previous status summary did not fully count.

The release adds the office-runtime marker expected by the existing post-transform plugin. This prevents that later transform from trying to inject a second office bootstrap after the GLB-first plugin has already wired the office layer.

## Files included

| File | Action |
|---|---|
| `build/calloria-glb-world-plugin.js` | Replace. Adds deferred, non-blocking startup, independent staff/office completion, truthful failure counts and the office-runtime marker. |
| `js/glb-asset-health-panel.js` | Replace. Keeps pending/settled state visible and counts failures without double-counting. |
| `js/glb-asset-path-fallback.js` | Included dependency from v6.81. Keep/replace with the supplied version so the existing world plugin import resolves. |
| `tests/*.mjs` | Add/replace the focused GLB regression tests. |
| `docs/*`, `INSTALL-GITHUB-v6.84.md`, `VERIFICATION-v6.84.md`, `TEST-RESULTS-v6.84.txt` | Release documentation and evidence. |

## Install through GitHub Desktop / File Explorer

1. Back up the existing CALLORIA checkout. Keep the existing repository and Vercel project.
2. Extract `CALLORIA-v6.84-NONBLOCKING-GLB-STARTUP.zip`.
3. Open `zaksz1991/calloria` in GitHub Desktop and select **Repository → Show in Explorer**.
4. Merge the archive contents into the existing repository root. Replace the matching `build/calloria-glb-world-plugin.js` and `js/glb-asset-health-panel.js` files. Keep the supplied `js/glb-asset-path-fallback.js` dependency available at that exact path.
5. Do not delete or replace `.git`, `public/assets/`, any GLB binaries, `.env` files, `vite.config.js`, the Supabase configuration or unrelated project files.
6. Do not add another registration for `calloriaGLBWorldPlugin()`; it is already registered in `vite.config.js`.
7. Review the changed-file list. Commit with:

   `CALLORIA v6.84 — non-blocking mobile GLB startup`

8. Push to `main`. Treat the release as deployed only after Vercel reports a successful production deployment.

## Phone acceptance checks

1. Open the deployed site in a fresh phone-browser tab and enter the 3D workplace.
2. Confirm the local workplace appears and the normal touch controls are usable before GLB files finish downloading.
3. Confirm the GLB status button is available only inside the immersive workplace and remains collapsed until selected.
4. Open the report immediately. It should say background loading is in progress; zero counts at this stage must not be presented as a completed failure.
5. Wait for the staff and office jobs to settle. Confirm each side updates independently.
6. If a staff model is rejected, confirm its asset ID and validation reason are shown. If an office model fails, confirm its failed asset ID and available reason are shown.
7. Exit the workplace while loading is still pending. Confirm the scheduled startup is cancelled or any late layer is disposed; re-entering the workplace must not create duplicate reports or duplicate layers.
8. Repeat on desktop to confirm the same interactions remain available.

## Configuration

No new environment variable, Supabase migration, Edge Function or npm dependency is introduced. Keep the existing Vite plugin registration and the current GLB assets.

## Important boundary

This release changes startup sequencing and diagnostics. It does **not** prove that every GLB file exists, is reachable, parses, passes validation or has an acceptable visual fit on your deployed phone. The status panel reports the actual runtime result; a successful deployment and physical-device test are still required.
