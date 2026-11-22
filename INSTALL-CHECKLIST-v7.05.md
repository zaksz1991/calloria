# v7.05 installation checklist

- [ ] Back up repository.
- [ ] Merge the ZIP at the repository root.
- [ ] Confirm `.nvmrc` remains 22.16.0.
- [ ] Confirm `.npmrc` contains `strict-allow-scripts=true`.
- [ ] Confirm `package.json` has `build`, `prebuild`, `postbuild`, `check` and `verify:navigation` scripts.
- [ ] Confirm the new navigation auditor exists under `tools/`.
- [ ] Confirm no extra Vite plugin registration was added.
- [ ] Commit and push to `main`.
- [ ] Confirm GitHub Actions is green.
- [ ] Confirm Vercel runs `npm run build` and deploys `dist/`.
