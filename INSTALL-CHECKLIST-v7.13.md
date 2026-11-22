# CALLORIA v7.13 install checklist

- [ ] Back up the current CALLORIA repository.
- [ ] Merge all package folders into the repository root.
- [ ] Keep the carried-forward v7.12 callback integrity engine and stylesheet.
- [ ] Add the v7.13 callback attempt engine and Vite plugin.
- [ ] Add the two regression test files.
- [ ] Register v7.12 once, followed by v7.13 once, in `vite.config.js`.
- [ ] Preserve all existing Vite plugins, Supabase configuration, `.env` files and `public/assets/` GLBs.
- [ ] Commit and push to `main`.
- [ ] Confirm Vercel completes `npm install`, prebuild navigation audit, Vite build and postbuild artifact audit.
- [ ] Open Promise Control and check that an interrupted attempt appears as an unsuccessful attempt, not a completed callback.
