# GitHub installation — v6.13.2

1. Open `github.com/zaksz1991/calloria`.
2. Open the root-level `package.json` (not one inside a subfolder).
3. Replace its contents with the supplied `package.json`.
4. Save the change to the `main` branch.

Keep `package-lock.json`; Vercel's configured `npm install` reconciles it with the manifest. Retain any additional dependencies already used by other repository modules if they are not represented in the supplied manifest.

This is the next dependency correction after v6.13.1. No Vite or source-file edits are required for the reported `@supabase/supabase-js` resolution error.
