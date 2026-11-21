# Install CALLORIA v6.87

This release repairs the v6.86 build failure in the current `c8a48d6` repository. It is a targeted cumulative overlay, not a complete repository export.

## Replace one runtime file

1. Back up the current CALLORIA repository folder.
2. Extract this ZIP.
3. In GitHub Desktop, open `zaksz1991/calloria` and select **Repository → Show in Explorer**.
4. Copy the extracted `build` folder into the repository root and allow Windows to merge folders.
5. Replace this file:

   `build/calloria-ruffneck-service-operations-v6-86.mjs`

6. Merge the included `tests` folder into the repository's existing `tests` folder. Do not delete existing tests.
7. Do not replace `vite.config.js`. The v6.86 plugin registration already exists in the commit that produced the supplied error.
8. Keep the existing dependency:

   `build/calloria-ruffneck-platform-support-v6-51.mjs`

9. Preserve `.git`, `public/assets/`, all GLB files, `.env` files, package files, Supabase configuration and unrelated build plugins.
10. Review the changed files in GitHub Desktop, commit as `CALLORIA v6.87 — RuffNeck transform source rebase repair`, and push to `main`.
11. Open the new Vercel deployment and inspect the build log.

## What a successful repair should show

- No `CALLORIA v6.86 source rebase failed` error.
- The v6.87 plugin may log that an applicant default was left unchanged when an upstream transform had already rewritten it. That is non-fatal.
- The Workforce service panel should be inserted before the existing System activity section.
- The previous fatal v6.85 third-person transform error should not return.

The v6.86 service catalogue file must remain in the repository because the service-operations plugin imports it as data. No new npm package or environment variable is required.
