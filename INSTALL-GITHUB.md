# Installation — CALLORIA v6.58

This ZIP is a cumulative build-integration package for the existing `zaksz1991/calloria` repository. It is not a full source-repository replacement.

## GitHub GUI installation

1. Download and extract the ZIP.
2. In the `calloria` GitHub repository, merge the included `build/` folder with the repository's existing `build/` folder. Keep all existing world, gameplay, and asset plugins; add the new `calloria-try-it-studio-v6-58.mjs` file and retain the cumulative v6.42–v6.57.1 files from this package.
3. Merge the included `tests/` folder with the repository's existing `tests/` folder. Preserve other tests and fixtures already in the repository.
4. Replace the repository-root `vite.config.js` with the included cumulative configuration.
5. Do not replace `package.json`, `package-lock.json`, `.env` files, Supabase settings, API keys, or the `public/assets/models/` folder.
6. Commit the changes to `main` and let Vercel deploy the commit.

## What should appear

Open CALLORIA Customer Care, choose a visitor goal in **Find the right place to start**, then use **Try a quick preview** on a product card. **Explore all previews** shows all six RuffNeck sample experiences. After a preview, use **Open [product]** or **Ask about access / pricing**.

The preview completion counter is browser-local. Clearing site data or using a different browser/device starts a separate progress record.
