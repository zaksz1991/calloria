# GitHub installation — CALLORIA v6.50

1. Download and extract the cumulative ZIP.
2. In the CALLORIA GitHub repository, upload/merge the included `build/` and `tests/` folders. Do not delete other existing build modules or tests.
3. Replace the repository's `vite.config.js` with the included cumulative configuration.
4. Commit the changes to the `main` branch.
5. Review the Vercel deployment log. A successful deployment is not confirmed by the ZIP tests.

Do not replace `package.json`, `package-lock.json`, `public/assets/`, Supabase settings or environment variables with this overlay.
