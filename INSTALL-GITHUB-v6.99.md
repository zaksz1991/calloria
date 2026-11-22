# Install CALLORIA v6.99 — GUI steps

This is an additive overlay for the current public `main` branch. It is not a full repository ZIP.

## 1. Back up the repository

In GitHub Desktop, select the `calloria` repository and use **Repository → Show in Explorer**. Copy the repository folder to a backup location before changing files.

## 2. Copy the three supplied files

Extract this ZIP. Copy the folders into the repository root and allow Windows to merge folders:

- `build/calloria-operations-capacity-outlook-v6-99.mjs`
- `js/operations-capacity-outlook-v6-99.js`
- `styles/operations-capacity-outlook-v6-99.css`

Do not overwrite existing files with different names.

## 3. Register the Vite plugin

Open `vite.config.js` in a plain text editor.

Add the import shown in `VITE-CONFIG-ADDITIONS-v6.99.txt` with the other build-plugin imports. Add `calloriaOperationsCapacityOutlookPluginV699()` as the final item in the existing `plugins` array, after the visitor-facing experience plugins.

Keep every existing registration and preserve the current plugin order. Do not replace the whole Vite configuration with an older version. Do not add the same registration twice.

## 4. Commit and push

In GitHub Desktop, review the changed files. Commit with:

`CALLORIA v6.99 — operations capacity outlook`

Push the commit to `main` and check the Vercel deployment result.

## 5. Verify in the application

Sign in to **Operations Intelligence** and open the Command Centre. After the aggregate report loads, the new **Backlog and demand forecast** panel should appear beneath the existing operational sections.

The panel requires at least three valid daily observations. If fewer are available, it reports insufficient history instead of making up a forecast.

## Preserved systems

This upgrade does not replace `operations-intelligence.html`, `js/operations-intelligence-workbench.js`, `js/operations-intelligence-engine.js`, `main.js`, 3D assets, Supabase configuration, Edge Functions, or existing Vite plugins. It adds no database migration or environment variable.
