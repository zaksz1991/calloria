# Build diagnosis — Vercel commit 312a171

The v7.04 build preflight passed. Dependency installation completed. The v7.05 prebuild navigation audit then stopped the build on one local route:

`/privacy.html` referenced by `support-router.html` did not resolve to a local file.

Inspection of the exact commit confirmed:
- `support-router.html` contains a footer link to `/privacy.html`.
- `privacy.html` is absent from the repository root.
- `public/privacy.html` is also absent.
- `vercel.json` has `cleanUrls: true`, but the link already includes `.html`; clean-URL mapping does not create a missing page.
- Vite is configured with `publicDir: 'public'`, so a file at `public/privacy.html` is copied into `dist/privacy.html` and is served at the linked URL.

The fix adds the missing public static page rather than weakening or bypassing the navigation audit.
