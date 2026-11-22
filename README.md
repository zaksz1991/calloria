# CALLORIA v7.03 — npm install-script and build restoration

This release repairs the current public `main` package manifest and carries forward the v7.01 preflight plus v7.02 post-build artifact audit.

The observed Vercel install log reported that npm audited one package after removing 23 packages, then failed because `npm run build` did not exist. A subsequent install log also reported that the `esbuild@0.25.12` postinstall script was blocked by npm's dependency-script approval policy.

v7.03 restores the app's pinned runtime dependencies and scripts, adds `esbuild@0.25.12` as an explicit dev dependency, and approves only that exact package version through npm's `allowScripts` package.json field. The preflight now rejects the same missing dependency or approval before Vite starts.

The release retains the existing Vite plugin registration order and multi-page entry list. It does not replace `vite.config.js`, HTML entry pages, application modules, Supabase settings, Vercel config, GLB assets or gameplay data.

This is a root-level build-system overlay, not a complete repository archive.
