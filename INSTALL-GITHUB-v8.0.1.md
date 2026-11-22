# CALLORIA v8.0.1 — GUI Installation Guide

**Target repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Existing Vercel project:** `calloria`  
**Repair target:** Vercel build failure at commit `e6336c5`

## What this repair fixes

The Vercel log showed that install preflight and navigation integrity passed. The next check, `calloria-v8-integration-audit.mjs`, then reported 45 missing local files. The reported files were mostly import statements embedded inside Vite plugin string constants. Those strings are inserted into other source files by Vite transforms, so their imports must be resolved relative to the transformed target (for example `js/main.js` or `js/production-world.js`), not relative to the `build/` plugin module.

This update corrects the source audit so it follows genuine top-level static imports and re-exports only. Vite/Rollup continues to resolve transform-added imports during the real build.

## Package type

This ZIP contains the cumulative v8.0 overlay plus the v8.0.1 audit correction. It is **not** the complete CALLORIA repository. The original repository's core files, `public/` assets, Supabase files and historical build plugins remain in your existing GitHub checkout and must be preserved.

## Install with GitHub Desktop and File Explorer

1. Make a backup copy of your current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Extract this ZIP. Copy the contents of the extracted `CALLORIA-v8.0.1-BUILD-AUDIT-REPAIR` folder into the existing repository root. Merge folders and replace matching files.
5. At minimum, ensure these two files are replaced with the v8.0.1 versions:
   - `tools/calloria-v8-integration-audit.mjs`
   - `tests/calloria-v8-integration.test.mjs`
6. Keep the existing `.git` folder, all core application pages, `js/main.js`, other `js/` modules, all existing `build/` plugins, `public/`, `public/assets/`, GLB models, `supabase/`, `.env` files, `package-lock.json`, `.nvmrc` and `vercel.json`.
7. Do not remove or regenerate the lockfile. This repair adds no dependency and changes no package version.
8. Review the changed-file list in GitHub Desktop. The application source, assets, Supabase files and deployment configuration must not show as deleted.
9. Commit to `main` with message `CALLORIA v8.0.1 — repair Vite import audit`, then select **Push origin**.
10. Open the resulting Vercel deployment and inspect the complete build log. Do not treat the push itself as a successful deployment.

## Expected build progression

The initial checks should continue to report:

- CALLORIA install preflight passed.
- CALLORIA build preflight passed.
- CALLORIA navigation audit passed.
- CALLORIA v8 integration audit passed, instead of the previous 45 false missing-file reports.

After that, Vite will run its actual transform and module-resolution process. If a genuinely missing module remains, Vite will report the exact source file and import path. This workspace cannot prove the complete remote production build until that Vercel run succeeds.

## Settings and data

- Keep Node.js 22.x as pinned by the current project manifest.
- Keep the existing Vite build command and `dist` output directory.
- No Vercel environment variable change is required.
- No Supabase migration, secret, Edge Function or database change is required.
