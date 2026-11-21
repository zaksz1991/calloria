# CALLORIA v6.86

Cumulative targeted overlay for the existing `zaksz1991/calloria` repository.

This package carries forward the v6.84 deferred GLB startup and diagnostics fixes, the v6.85 current-world third-person plugin repair, and adds the v6.86 RuffNeck service-operations rebase.

Start with `INSTALL-GITHUB-v6.86.md`. This is not a full repository replacement. It does not contain the user's complete app source, `public/assets/` GLB library, environment files or Supabase configuration. Preserve the existing file `build/calloria-ruffneck-platform-support-v6-51.mjs`; v6.86 imports its catalogue data.

Regression evidence is in `TEST-RESULTS-v6.86.txt`, `TEST-RUN-OUTPUT-v6.86.txt` and `VERIFICATION-v6.86.md`. The full Vite production build and Vercel deployment remain unverified.
