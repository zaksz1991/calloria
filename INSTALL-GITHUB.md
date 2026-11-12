# GitHub installation — v6.12

1. Open the CALLORIA repository on GitHub.
2. Open `build/calloria-cc0-staff-glb-bundle-plugin.mjs`.
3. Replace the complete file with the file at the same path in this ZIP.
4. Commit the one-file change to `main`.
5. Let the existing Vercel deployment run.

Do not replace `vite.config.js`, `js/world-player-avatar.js`, `js/main.js`, `js/production-world.js`, or any files under `public/assets/models/` for this release.

The plugin factory and plugin registration name are unchanged, so the Vite config does not need a corresponding edit.
