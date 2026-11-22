# CALLORIA v7.07 — Installation

## Scope

This is an additive overlay for the current public `main` source. It adds a read-only 3D runtime report inside the existing `3D ASSET STATUS` panel. It does not replace the repository, existing GLB loaders, local fallback world, models, or saved data.

## Add these files

- `build/calloria-world-runtime-diagnostics-v707.mjs`
- `js/calloria-world-runtime-diagnostics-v707.js`
- `tests/world-runtime-diagnostics-v707.test.mjs`

## Add the Vite registration

Open the existing `vite.config.js` from the CALLORIA repository in File Explorer's text editor (not a replacement copy).

1. Add the import shown in `VITE-CONFIG-ADDITIONS-v7.07.txt` alongside the existing build-plugin imports.
2. Add `calloriaWorldRuntimeDiagnosticsPluginV707()` once as the final plugin entry, after `calloriaTryItStudioPlugin()`.
3. Preserve every existing import, plugin registration, Rollup entry, and build setting.

The plugin has `enforce: 'post'`. It must run after the existing `calloriaGLBWorldPlugin()` transform has injected the GLB-first world bootstrap. Do not register it more than once.

## Commit

`CALLORIA v7.07 — add 3D scene visibility diagnostics`

Push the `main` branch and inspect the Vercel deployment. The new diagnostic is additive; it does not change the application build command, Node version, Supabase configuration, environment variables, or asset bundle policy.

## Where to see it

Enter the 3D workplace, open the existing `3D ASSET STATUS` control, and scroll to **LIVE 3D SCENE & VISIBILITY DIAGNOSTICS**. The section is inserted into that panel; no separate floating button is added.

The report updates only while the existing asset panel is open. It reports scene and renderer measurements; it does not force objects visible or modify GLB placement.
