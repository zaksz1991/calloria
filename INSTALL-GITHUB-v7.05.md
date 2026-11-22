# CALLORIA v7.05 — GitHub Desktop installation

This is a cumulative overlay. It carries forward the v7.04 production build repair and adds navigation integrity checks. It is not a complete repository archive.

## Replace / add

Replace:
- `package.json`
- `tools/calloria-build-preflight.mjs`
- `build/calloria-third-person-player-plugin.mjs`
- `.nvmrc`
- `.npmrc`

Add or merge:
- `tools/calloria-navigation-integrity-audit.mjs`
- `tests/navigation-integrity-v705.test.mjs`
- `.github/workflows/calloria-production-build.yml`
- `tests/build-preflight-v701.test.mjs`
- `tests/third-person-player-v704.test.mjs`
- `tests/build-artifact-audit-v702.test.mjs`
- `tests/npm-install-policy-v703.test.mjs`
- existing v7.04 documentation and tools included in this archive

The pre-existing `tools/calloria-build-artifact-audit.mjs` is carried forward unchanged.

## GUI installation

1. Back up the CALLORIA repository folder.
2. Open the repository in GitHub Desktop and select **Repository → Show in Explorer**.
3. Extract this ZIP into a temporary folder.
4. Copy the ZIP contents into the existing repository root. Allow listed files to be replaced; merge folders without deleting unrelated files.
5. Review the GitHub Desktop changed-file list. Preserve `.git`, all HTML pages, `js/`, `styles/`, `public/`, `public/assets/`, Supabase migrations, Vercel configuration and environment files.
6. Commit as `CALLORIA v7.05 — add route and navigation integrity gate`.
7. Push to `main`.

## Expected checks

- `npm run check` validates the build manifest and all routes/views.
- `npm test` includes the seven new navigation-integrity cases.
- `npm run build` runs manifest preflight, route/view audit, Vite build and the v7.02 artifact audit.
- GitHub Actions runs the same sequence on pushes and pull requests.

Keep Vercel settings as Install Command `npm install`, Build Command `npm run build`, Output Directory `dist`.

## Safeguards

- Do not replace `vite.config.js` or `vercel.json`.
- Do not add a second copy of any existing Vite plugin registration.
- Do not delete `.git`, real GLB assets, `.env` files, Supabase keys, migrations or existing gameplay files.
- The navigation audit validates static references and navigation identifiers; it does not replace browser/device testing.
