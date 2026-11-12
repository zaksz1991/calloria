# CALLORIA v6.24 — GitHub Desktop installation

## Replace one file

| ZIP path | Repository destination | Action |
|---|---|---|
| `public/glb-asset-lab.html` | `public/glb-asset-lab.html` | Replace |

The `tests/` file is optional regression coverage and can be merged into the repository's existing `tests/` folder.

## Install

1. Extract the ZIP in Windows File Explorer.
2. Open the `zaksz1991/calloria` repository in GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Replace the existing `public/glb-asset-lab.html` with the ZIP version.
5. Optionally copy `tests/calloria-v624-glb-fit-validation.test.mjs` into the existing `tests` folder.
6. Review the changed-file list. The only production file changed should be `public/glb-asset-lab.html`.
7. Commit and push to `main`.
8. After Vercel deployment, open `https://calloria.vercel.app/glb-asset-lab.html`.

## Protected files

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `js/production-world.js`, `js/glb-world-integration.js`, `js/glb-office-world-integration.js`, Supabase settings or any `public/assets/models/` binaries for this upgrade.
