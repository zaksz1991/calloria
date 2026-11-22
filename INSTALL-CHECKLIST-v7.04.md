# v7.04 installation checklist

- [ ] Back up the current repository folder.
- [ ] Replace root `package.json`, `.nvmrc`, `.npmrc`.
- [ ] Replace `build/calloria-third-person-player-plugin.mjs`.
- [ ] Replace `tools/calloria-build-preflight.mjs`.
- [ ] Merge the three test files supplied/updated by this overlay.
- [ ] Add `.github/workflows/calloria-production-build.yml`.
- [ ] Keep `tools/calloria-build-artifact-audit.mjs`.
- [ ] Keep `vite.config.js`, `vercel.json`, all app pages, Supabase files, environment variables and public GLB assets unchanged.
- [ ] Commit and push to `main` through GitHub Desktop.
- [ ] Confirm the GitHub Actions workflow completes install, tests, preflight, Vite build and post-build audit.
- [ ] Check the matching Vercel deployment log. Do not mark production recovered until Vercel reports a successful deployment.
