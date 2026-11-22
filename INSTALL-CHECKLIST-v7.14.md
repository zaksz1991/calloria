# CALLORIA v7.14 installation checklist

- [ ] Back up the current CALLORIA repository folder.
- [ ] Add the supplied `build/`, `js/` and `tests/` files.
- [ ] Add the v7.14 import to the existing `vite.config.js`.
- [ ] Register `calloriaSimulatedCallbackClockV714Plugin()` once at the end of the existing plugin array.
- [ ] If registered, remove the older v7.13 callback-attempt plugin import and registration only.
- [ ] Keep the existing v7.12 read-only Promise Control panel if it is installed.
- [ ] Preserve Supabase settings, `.env` files, `public/assets/`, GLB binaries and existing pages.
- [ ] Commit as `CALLORIA v7.14 — simulated callback clock integrity`.
- [ ] Push to `main`.
- [ ] Confirm Vercel completes the production build.
- [ ] Test a callback before, at and after its simulated due time.
- [ ] Confirm callback, commitment and worklist due timestamps remain identical before and after resume.
