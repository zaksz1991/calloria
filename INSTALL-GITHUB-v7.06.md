# Install CALLORIA v7.06 — GUI steps

1. Download and extract `CALLORIA-v7.06-PRIVACY-ROUTE-REPAIR.zip`.
2. Open the existing CALLORIA repository with GitHub Desktop.
3. Choose **Repository → Show in Explorer**.
4. Copy the supplied `public` folder into the repository root and merge it with the existing `public` folder. Do not delete or replace existing public assets.
5. Copy the supplied `tests/privacy-route-v706.test.mjs` into the existing `tests` folder.
6. Confirm the resulting paths are exactly:
   - `public/privacy.html`
   - `tests/privacy-route-v706.test.mjs`
7. Review the two added files in GitHub Desktop, then commit and push to `main`.

Suggested commit message:

`CALLORIA v7.06 — add missing privacy route`

## Do not replace

Do not replace `package.json`, `vite.config.js`, `vercel.json`, `.npmrc`, `.nvmrc`, `tools/calloria-navigation-integrity-audit.mjs`, `main.js`, Supabase files, `.env` files, `public/assets`, or any GLB models. v7.06 only supplies a missing static privacy page and its regression test.

## Expected build effect

Vite's existing `publicDir: 'public'` copies `public/privacy.html` to `dist/privacy.html`. The v7.05 navigation audit already checks for a matching file in `public/`, so the reported `/privacy.html` reference should resolve without a Vite config edit.
