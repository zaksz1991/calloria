# CALLORIA v7.03 — installation

## Apply this release instead of stacking v7.00, v7.01 and v7.02 separately

This is a cumulative build-system overlay for the current repository root. It repairs the package manifest and carries forward the build preflight and artifact audit.

### Files to merge into the repository root

- `package.json` — restored dependencies/scripts, exact esbuild install-script approval, prebuild and postbuild hooks.
- `.nvmrc` — Node 22.16.0, matching the existing repository baseline.
- `tools/calloria-build-preflight.mjs` — updated install/build checks.
- `tools/calloria-build-artifact-audit.mjs` — carried forward from v7.02.
- `tests/build-preflight-v701.test.mjs` — updated fixtures for esbuild approval.
- `tests/build-artifact-audit-v702.test.mjs` — carried forward from v7.02.
- `tests/npm-install-policy-v703.test.mjs` — new npm lifecycle policy tests.
- `docs/` and verification notes — documentation only.

### GUI installation

1. Back up the current CALLORIA repository folder.
2. Open CALLORIA in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Extract this ZIP. Copy its contents into the existing repository root. Allow `package.json` and `.nvmrc` to be replaced. Merge the `tools`, `tests` and `docs` folders; do not delete unrelated existing files.
5. In GitHub Desktop, check the changed-file list. The application entry pages, `vite.config.js`, `js/`, `styles/`, `public/`, `supabase/`, `.env` files and `vercel.json` must remain unchanged.
6. Commit: `CALLORIA v7.03 — restore npm build and esbuild install approval`.
7. Push to `main` and open the Vercel deployment for the new commit.

### Expected Vercel sequence

- `npm install` runs the Node 22 preinstall guard.
- npm installs the pinned application dependencies.
- npm permits only `esbuild@0.25.12` to run its install-time lifecycle script, so esbuild can initialise its platform binary.
- `npm run build` runs the dependency/source preflight, then `vite build`, then the post-build output audit.
- A deployment should not be considered successful unless the final Vercel log shows `npm run build` completed and `postbuild` reports the artifact audit passed.

### Vercel settings

Keep:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

The current tracked `vercel.json` already declares these values. Do not change it for this release.

### Important boundaries

- This is not a complete repository replacement.
- Do not replace `vite.config.js` or change its plugin order.
- Do not remove existing source files or old tests.
- Do not upload `.env` or Supabase secrets to GitHub.
- Preserve `public/assets/` and all real GLB binaries.
- No Supabase migration or environment-variable change is required.
