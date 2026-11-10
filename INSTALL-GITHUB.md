# CALLORIA v4.0 — GitHub Desktop installation

## Files

| ZIP path | Repository destination | Action |
|---|---|---|
| `public/glb-asset-lab.html` | `public/glb-asset-lab.html` | Add |
| `tests/calloria-v40-glb-asset-lab.test.mjs` | `tests/calloria-v40-glb-asset-lab.test.mjs` | Add |

No existing file is replaced. In particular, do not replace `vite.config.js`, `package.json`, `index.html`, `main.js`, GLB registry files or model binaries.

## Install with GitHub Desktop

1. Extract the ZIP in Windows File Explorer.
2. Open `zaksz1991/calloria` in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy `public/glb-asset-lab.html` into the repository's existing `public` folder.
5. Copy `tests/calloria-v40-glb-asset-lab.test.mjs` into the existing `tests` folder.
6. Review the changed-file list. It should contain only those two added files.
7. Commit as `CALLORIA v4.0.0 — add GLB visual acceptance lab` and push to `main`.
8. After Vercel deployment, open `https://calloria.vercel.app/glb-asset-lab.html`.

## Runtime requirements

- The deployed app must contain its public `/assets/models/` GLB files.
- The v3.9 staff bundle manifest must exist for staff-model preview.
- The browser must be able to reach jsDelivr for pinned Three.js 0.170.0 modules.
- The application deployment must serve `/draco/` decoder assets for Draco-compressed models.

## Verification boundary

This package has no Vite plugin and cannot create a plugin-anchor failure. Tests and JavaScript syntax are checked locally. A live browser/WebGL inspection and the site's next Vercel build remain external acceptance checks.
