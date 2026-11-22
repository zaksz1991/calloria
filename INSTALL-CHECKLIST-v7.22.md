# CALLORIA v7.22 installation checklist

- [ ] Back up the current repository state.
- [ ] Merge `build/`, `js/`, `styles/` and `tests/` from the ZIP into the repository root.
- [ ] Replace root `vite.config.js` with the supplied complete replacement.
- [ ] Confirm `calloriaDigitalExperienceSuitePluginV722()` appears once.
- [ ] Confirm no separate v7.20 or v7.21 suite registration remains.
- [ ] Preserve `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `vercel.json`, `.env` and Supabase configuration.
- [ ] Preserve `public/assets/` and all GLB files.
- [ ] Commit and push through GitHub Desktop.
- [ ] Verify GitHub Actions succeeds.
- [ ] Verify Vercel completes `npm run build` and publishes `dist/`.
- [ ] Open Digital Support and confirm the response coach, queue triage, specialist handoff, disposition evidence and follow-up response SLA panels appear.
