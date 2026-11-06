# CALLORIA 0.3.0 — GUI deployment guide

Target GitHub repository: `zaksz1991/calloria`  
Target Vercel site: `calloria.vercel.app`  
Production branch: `main`

## 1. Replace the repository files with this release

1. Extract the `CALLORIA-v0.3.0.zip` archive in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop. If it is not on this computer, clone it from GitHub Desktop first.
3. In GitHub Desktop, use **Repository → Show in Explorer** to open the local repository folder.
4. Copy the contents of the extracted `CALLORIA-v0.3.0` folder into the local repository root. Do not copy an outer wrapper folder and do not delete the repository's hidden `.git` folder.
5. Allow File Explorer to replace matching files.
6. Delete these obsolete files from the local repository if they remain from the former release:
   - `assets/floorshift-mark.svg`
   - `tests/floorshift.test.mjs`
7. Return to GitHub Desktop. Review the changed-file list. It should include the CALLORIA 0.3.0 source, Vite configuration, tests and documentation.
8. Use the commit summary `CALLORIA v0.3.0 — game-first shell and mobile controls`, select **Commit to main**, then **Push origin**.

## 2. Vercel project settings

The repository contains `vercel.json` with the build configuration. The connected Vercel project should use:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (22.12.0 minimum)

A push to `main` should trigger the connected Vercel production deployment. Keep the existing `calloria.vercel.app` domain attached to the same project.

## 3. Post-deployment checks

Check the browser title, header, footer, 3D monitor textures and reception sign for CALLORIA branding. Enter the 3D floor on desktop and phone. On a touch device, verify the left movement joystick, scene drag-look, RUN button, station proximity prompt, USE button and EXIT GAME button. Check all recruitment and employee operation views.

The build has seven passing automated source/regression tests. A local Vite production build could not be run in the preparation environment because npm registry DNS was unavailable. Vercel must run the configured dependency installation and production build; a successful deployment is not assumed in advance.
