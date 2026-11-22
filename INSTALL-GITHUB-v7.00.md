# CALLORIA v7.00 — Build Manifest Restoration

## Exact repair

Replace **only** the root `package.json` in the CALLORIA repository with the `package.json` supplied in this ZIP.

Do not replace `vite.config.js`, `index.html`, `main.js`, the `build/` directory, any `js/` files, `public/assets/`, GLB models, Supabase configuration, environment variables, or `.git`.

## GitHub Desktop / File Explorer steps

1. Download and extract this ZIP.
2. Open GitHub Desktop and select the `calloria` repository.
3. Use **Repository → Show in Explorer**.
4. Open the extracted `CALLORIA-v7.00-BUILD-MANIFEST-RESTORE` folder in another File Explorer window.
5. Copy its `package.json` into the repository root.
6. Confirm Windows asks to replace the existing `package.json`; replace that file only.
7. Return to GitHub Desktop. Review the single changed file and confirm it is `package.json`.
8. Commit with: `CALLORIA v7.00 — restore Vite build manifest`.
9. Push to `main` and inspect the new Vercel deployment.

## After pushing

Vercel should install the declared runtime dependencies and Vite, then execute `npm run build` as `vite build`.

The log should no longer say `removed 23 packages, and audited 1 package`, and should no longer say `Missing script: "build"`.

If the next deployment still fails to resolve Vite or continues showing the old one-package installation, use Vercel's **Redeploy → Clear Build Cache** once. Do not change the Vercel Build Command; `npm run build` is correct for this repository.

## Why the repair is limited to one file

The failed deployment was built from commit `a0623b3`. At that exact commit, `package.json` contains only the project name, module type, and a `test` script. It has no `build` script, no Vite dependency, and no Supabase or Three.js dependencies. The current public `main` manifest has the expected Vite scripts and dependencies. This ZIP restores that manifest without touching the application source.
