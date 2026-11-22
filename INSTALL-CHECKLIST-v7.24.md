# CALLORIA v7.24 — Installation checklist

- [ ] Back up the existing repository folder.
- [ ] Merge `build/`, `js/`, `styles/` and `tests/` from this package.
- [ ] Replace root `vite.config.js` with the included v7.24 config.
- [ ] Confirm `calloriaDigitalExperienceSuitePluginV722()` remains registered once.
- [ ] Confirm `calloriaDigitalCompletionSuitePluginV724()` is registered once immediately after v7.22.
- [ ] Do not separately register the v7.23 plugin.
- [ ] Preserve package manifest, lockfile, Vercel config, Supabase config and all assets.
- [ ] Commit and push to `main` through GitHub Desktop.
- [ ] Confirm Vercel executes `preinstall`, `prebuild`, `vite build` and `postbuild` successfully.
- [ ] Confirm the production page opens and the Customer 360 recovery accordion appears for a returning synthetic customer.
- [ ] Confirm a fresh applicant defaults to General Customer Experience.
- [ ] Confirm a pre-existing saved applicant retains their previous selected track and any populated department/salary; older missing fields are backfilled from their saved track.
