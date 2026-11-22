# Install CALLORIA v7.12 using GitHub Desktop and File Explorer

This is an additive overlay, not a complete repository replacement.

## 1. Back up the repository

In GitHub Desktop, open the CALLORIA repository. Use **Repository → Show in Explorer**. Copy the repository folder to a backup location before merging these files.

## 2. Merge the supplied files

Extract `CALLORIA-v7.12-CALLBACK-INTEGRITY.zip`.

Copy these files into the repository while preserving the folder structure:

| ZIP path | Repository destination | Action |
|---|---|---|
| `js/callback-integrity-engine-v712.js` | `js/callback-integrity-engine-v712.js` | Add |
| `build/calloria-callback-integrity-v712-plugin.mjs` | `build/calloria-callback-integrity-v712-plugin.mjs` | Add |
| `styles/calloria-callback-integrity-v712.css` | `styles/calloria-callback-integrity-v712.css` | Add |
| `tests/callback-integrity-v712.test.mjs` | `tests/callback-integrity-v712.test.mjs` | Add |

Do not replace `main.js`, `index.html`, `package.json`, `vercel.json`, `vite.config.js`, Supabase files, `.env` files or `public/assets/`.

## 3. Register the Vite plugin once

Open `vite.config.js` in your existing editor or GUI text editor.

Add the import and final plugin registration exactly as shown in `VITE-CONFIG-ADDITIONS-v7.12.txt`. Keep `calloriaTryItStudioPlugin()` and all other current plugins. The new plugin must appear after the existing entries.

## 4. Commit and deploy

In GitHub Desktop, review the changed files. Confirm the four new files and the `vite.config.js` edit are the only intended changes. Commit with:

`CALLORIA v7.12 — callback promise/task integrity`

Push to `main` and inspect the Vercel deployment.

## 5. Where to find the upgrade

Open the simulator's **Promise Control** view. The new **Callback task integrity** panel appears above the existing customer promise risk portfolio. It checks the locally loaded simulation snapshot.

## Important

The panel is diagnostic only. It does not automatically repair callback records. Review any finding against the original promise and callback history before editing saved data. No Supabase migration or new environment variable is required.
