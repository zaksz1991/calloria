# CALLORIA v7.01 — Build Guard & Runtime Pin

This is a targeted overlay to restore the Vite production build manifest and keep CALLORIA on Node 22.x while preventing a repeat of the test-only `package.json` regression.

Apply the ZIP at the CALLORIA repository root. See `INSTALL-GITHUB-v7.01.md` for GitHub Desktop steps.

Main files:
- `package.json`
- `.nvmrc`
- `tools/calloria-build-preflight.mjs`
- `tests/build-preflight-v701.test.mjs`

This is not a complete repository archive. Do not delete or replace existing application files, public assets, `.git`, Vite plugins, Supabase configuration or environment files.
