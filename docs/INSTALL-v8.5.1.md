# CALLORIA v8.5.1 — Updated Files Installation

This is a two-source-file repair overlay plus one regression test. It is not a full repository archive.

## Files

- `build/calloria-workforce-trend-cloud-sync-v801.mjs` — replace.
- `tests/workforce-cloud-plugin-v851-link.test.mjs` — add.
- `docs/CHANGELOG-v8.5.1.md` — add.
- `docs/TEST-RESULTS-v8.5.1.txt` — add.
- `UPDATED-FILES.txt` — add.

## Install with GitHub Desktop / File Explorer

1. Extract this ZIP.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Copy the ZIP contents into the existing repository root. Replace the one matching build-plugin file and add the new test and documentation files.
5. Do not replace `vite.config.js`, `package.json`, the v8 integration audit, the workforce suite, any Supabase migration, or unrelated source files.
6. Preserve `.git`, `public/assets/`, GLB models, local environment files and all existing project configuration.
7. Review the changed-file list. It should show one modified build plugin and the new test/documentation files.
8. Commit with `CALLORIA v8.5.1 — restore v8.4 conflict engine dependency` and push to `main`.

## Expected Vercel effect

The existing v8 integration audit looks for the direct import:

`from '../js/workforce-trend-cloud-sync-engine-v803.js'`

This patch restores that exact dependency while retaining the v8.5 recovery-backup engine import. The previously reported single prebuild issue should therefore clear. Vite compilation and post-build artifact checks must still complete successfully before the deployment is considered green.

## Configuration

- No Supabase migration.
- No environment variable or API key changes.
- No dependency changes.
- No Vercel setting changes.
