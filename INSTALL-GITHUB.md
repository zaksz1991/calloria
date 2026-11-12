# Installation — CALLORIA v6.32

Apply this patch on top of CALLORIA v6.31.

In GitHub, open the existing file:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Replace its complete contents with the file at the same path in this ZIP, then commit to `main`.

No other application file needs to be replaced. No package manifest, lockfile, Vite configuration, Supabase setting, API key, database migration or public asset is changed.

The update adds procedural eyelid movement only to static-pose skinned GLBs that already contain recognised eye-blink morph targets. Authored animated GLBs are unchanged. A deployed Vercel build and actual browser rendering must still be confirmed in the project.
