# v7.03 source baseline

Audited public repository: `https://github.com/zaksz1991/calloria`, branch `main`.

The current raw `package.json` on main identifies the package as `calloria-v6.99-operations-capacity-outlook`, is private and ESM, but contains only the `test` script. It declares no dependencies, no Vite build script and no Node engine range. This is consistent with the Vercel failure that audited one package, removed 23 packages and stopped with `Missing script: "build"`.

The current `.nvmrc` contains `22.16.0`.

The existing `vite.config.js` imports Vite and a sequence of 23 local CALLORIA build plugins, then declares 20 build inputs: 19 HTML pages plus `widgets/calloria-chat.js`. It outputs to `dist/` and names the chat bundle `widgets/calloria-chat.js`.

The current tracked `vercel.json` declares `installCommand: npm install`, `buildCommand: npm run build` and `outputDirectory: dist`.

The current Supabase cloud module imports `@supabase/supabase-js` dynamically; GLB modules import Three.js and its addon loaders; the main application dynamically imports `three`. Those direct dependencies are restored in the replacement manifest.

The supplied Vercel log additionally reports `esbuild@0.25.12` with `postinstall: node install.js` not yet covered by npm's `allowScripts` policy. v7.03 pins and approves that exact version.

No current full repository ZIP was available in this task. Consequently this release is a verified root-level overlay, not a complete source replacement. It does not claim a successful Vite build or live Vercel deployment.
