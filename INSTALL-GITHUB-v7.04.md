# CALLORIA v7.04 — GitHub Desktop installation

This is a cumulative overlay for the existing `zaksz1991/calloria` repository. It is not a new repository and does not include the whole application.

## Replace these files

- `package.json`
- `.nvmrc`
- `.npmrc`
- `build/calloria-third-person-player-plugin.mjs`
- `tools/calloria-build-preflight.mjs`

## Add or merge these files

- `.github/workflows/calloria-production-build.yml`
- `tests/third-person-player-v704.test.mjs`
- Updated `tests/build-preflight-v701.test.mjs`
- Updated `tests/npm-install-policy-v703.test.mjs`
- `README.md`, `CHANGELOG-v7.04.md`, `BUILD-FAILURE-DIAGNOSIS-v7.04.md`, `SOURCE-BASELINE-v7.04.md`, `VERIFICATION-v7.04.md`, `INSTALL-CHECKLIST-v7.04.md`

The updated preflight expects the existing `tools/calloria-build-artifact-audit.mjs` to remain in the repository; it is deliberately not replaced.

## GUI installation

1. Back up the current CALLORIA repository folder.
2. Open the existing repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Extract this ZIP to a temporary folder.
5. Copy its contents into the existing repository root. Allow the listed replacement files to be replaced. Merge `.github`, `build`, `tests` and `tools`; do not delete unrelated files.
6. Review the changed-file list. Keep `vite.config.js`, `vercel.json`, all HTML pages, `js/`, `styles/`, `public/`, `public/assets/`, Supabase migrations, `.git` and all environment files intact.
7. Confirm the new workflow appears at `.github/workflows/calloria-production-build.yml`.
8. Commit as `CALLORIA v7.04 — restore production build and add CI gate`.
9. Push to `main`.

## Expected GitHub Actions stages

The workflow named **CALLORIA production build** must:

1. Set up Node from `.nvmrc` (22.16.0).
2. Set up npm 11.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm run check`.
6. Run `npm run build` (which also runs the prebuild check and post-build artifact audit).

A green workflow is a full CI build against the pushed repository. The preparation tests in the ZIP are not a substitute for that run.

## Vercel settings

Keep the existing configuration:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

The preflight now verifies these values from `vercel.json`. Do not change `vite.config.js`, `vercel.json`, plugin order or environment variables for this repair. Do not add a second third-person plugin registration; `vite.config.js` already imports and registers its existing factory.

## Safeguards

- Do not upload `.env`, `.env.local`, Supabase service-role keys or Groq secrets.
- Do not delete `.git`, `public/assets/`, model GLBs, Supabase migrations, application pages or existing tests.
- Preserve `tools/calloria-build-artifact-audit.mjs`; the restored `postbuild` script uses it.
- The `.npmrc` policy is intentionally strict: if a later dependency introduces an install lifecycle script, npm stops until it is reviewed and explicitly approved.
