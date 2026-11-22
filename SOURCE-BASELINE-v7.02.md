# CALLORIA v7.02 source baseline

Prepared 22 November 2026 against the publicly readable `zaksz1991/calloria` `main` source and the v7.01 build-system overlay.

## Observed CALLORIA repository configuration

- `vite.config.js` configures `dist/` as output and has 20 named Rollup entries: 19 HTML application entries plus the `calloriaChatWidget` JavaScript entry.
- The `calloriaChatWidget` entry has a custom output filename of `widgets/calloria-chat.js`.
- `vercel.json` already specifies `npm install`, `npm run build`, and `dist`.
- The CC0 staff bundler writes the generated staff manifest during its `buildStart` hook and emits `calloria-staff-glb-diagnostics.html` and `.json` during `generateBundle`.
- The generated diagnostics JSON identifies schema version 1 and product CALLORIA; the CC0 staff manifest identifies schema version 2 and contains the five configured model records.
- The CC0 bundler explicitly permits unavailable model downloads and records those failures in its manifest while retaining the local/procedural fallback path.

## Vite output-order detail

The pinned Vite 6.4.5 build implementation first invokes `rollup(rollupOptions)` and then calls `prepareOutDir(...)`; `prepareOutDir` empties `dist` and copies the configured public directory. The CC0 bundler's `buildStart` hook therefore runs before public files are copied into `dist`, so manifest/GLB files written to `public/` during `buildStart` are included in the public copy. See Vite 6.4.5 `packages/vite/src/node/build.ts`, especially the build sequence and `prepareOutDir` implementation.

## v7.02 scope

This release carries forward the v7.01 manifest/preflight checks and adds `postbuild` artifact validation. It does not replace Vite configuration or application source. Tests use isolated generated fixtures and do not claim that the live full application build has passed.
