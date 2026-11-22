# CALLORIA v7.02 — Build Artifact Integrity Audit

## Why this release exists

v7.01 checks the package manifest, Vite plugin imports and configured source entry points before Vite starts. It does not verify that the finished `dist/` directory contains every configured page, every local asset referenced by the built HTML, the public chat widget, or the generated GLB deployment diagnostics.

v7.02 adds a post-build audit that runs automatically after `vite build` and before Vercel deploys the output directory.

## Changes

- Adds `postbuild` and `verify:build-artifacts` npm scripts.
- Derives configured HTML entries from the current `vite.config.js` instead of hard-coding the entire page list.
- Verifies each configured HTML entry exists and is non-empty in `dist/`.
- Verifies the dedicated `widgets/calloria-chat.js` output.
- Checks root-relative scripts, stylesheets, icons, module preloads, images and source assets referenced by built HTML.
- Checks that both generated GLB diagnostics files and the CC0 staff manifest exist and contain the expected schema.
- Verifies GLB magic bytes for each staff model marked available in the generated manifest.
- Treats unavailable optional CC0 models as warnings, not build failures, because the existing local/procedural fallback remains the supported degraded mode.
- Verifies `vercel.json` still publishes `dist/` and uses `npm run build`.

## Non-changes

No gameplay code, mobile UI, Supabase schema, credentials, environment variables, source asset files, or GLB model binaries are changed. No optional model is promoted to required. The audit cannot prove that a browser successfully rendered a model in a live session.
