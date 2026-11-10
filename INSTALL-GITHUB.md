# Install CALLORIA v3.5 through GitHub's graphical interface

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Deployment:** `https://calloria.vercel.app`

This is a four-file overlay patch, not a complete replacement of the CALLORIA application. Keep all existing recruitment, operations, career, Supabase, public asset and other application files.

## 1. Open the correct repository

1. Open the existing `zaksz1991/calloria` repository on GitHub.
2. Confirm the selected branch is `main`.
3. Open the repository root and verify that `vite.config.js`, `build/` and `tests/` already exist.
4. Do not use an older v1.4.0 snapshot or the earlier v3.4 patch as the source baseline.

## 2. Add or replace the files

Extract this ZIP. In the extracted folder, keep the same relative paths shown below. Upload or replace these exact files in GitHub:

| Action | Repository path | ZIP path |
|---|---|---|
| **Replace completely** | `vite.config.js` | `vite.config.js` |
| **Add** | `build/calloria-first-working-shift-v3-5-plugin.mjs` | `build/calloria-first-working-shift-v3-5-plugin.mjs` |
| **Replace completely** | `build/calloria-third-person-player-plugin.mjs` | `build/calloria-third-person-player-plugin.mjs` |
| **Add** | `tests/calloria-first-working-shift-v3-5.test.mjs` | `tests/calloria-first-working-shift-v3-5.test.mjs` |

Use GitHub's **Add file → Upload files** for new files. For replacement files, open the existing file, choose the edit/upload replacement workflow available in the GitHub interface, and replace its entire contents with the matching ZIP file. Preserve the directory names. Do not upload the outer ZIP folder as an additional nested directory.

Do not modify `package.json`, `package-lock.json`, `js/main.js`, `js/production-world.js`, `js/glb-world-integration.js`, `js/world-player-avatar.js`, any Supabase migration, environment variable or secret as part of this patch.

## 3. Commit

Use this commit message:

`CALLORIA v3.5 — first working shift and mobile player repair`

Review the changed-file list. It should contain only the four repository paths above. Commit to `main`.

## 4. Deployment gate

The connected Vercel project should start a deployment from the `main` commit. Do not treat the update as live until the Vercel deployment reports **Ready** and its build completed successfully.

The v3.5 Vite plugin resolves the Draco decoder files from the installed `three` package at build time. A successful production build must therefore confirm that the current dependency installation includes:

- `three/examples/jsm/libs/draco/gltf/draco_decoder.js`
- `three/examples/jsm/libs/draco/gltf/draco_decoder.wasm`
- `three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js`

The build emits them under `dist/draco/`. No SQL migration, Vercel environment variable or API secret is required by this patch.

## 5. Post-deployment gameplay check

Use an Android device and check the following sequence:

1. Open `https://calloria.vercel.app` and enter the existing 3D workplace.
2. Confirm the mobile view no longer shows the third-person player GLB with arms held out in a default pose. The original first-person movement and camera controls should remain available.
3. Confirm the mission card is compact and does not dominate the screen.
4. Tap **OPEN WORK DESK**. An applicant should be routed to recruitment; an employed agent should be routed through the Workforce/briefing gate.
5. Use the Workforce screen to record attendance at the simulated 07:30 morning briefing or 14:00 afternoon briefing.
6. At or after 08:00 for the morning shift, or 14:00 for the afternoon shift, open inbound work. Before the scheduled start or without that day's attendance, the queue must remain blocked and Workforce should be shown.
7. Once the shift starts, confirm the view opens inbound operations, not only a generic overview.
8. Accept a synthetic customer, complete the existing scenario, save the CRM/case outcome and disposition, and inspect the existing QA/performance records.
9. On desktop, inspect the GLB asset-status tooltip for the specific rejected model IDs and loading reasons if staff still fall back to local meshes.

Do not report the full sequence as passed until it has actually been completed in the deployed browser.
