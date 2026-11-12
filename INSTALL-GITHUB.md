# Installation — CALLORIA v6.31

Apply this patch on top of CALLORIA v6.30.

In GitHub, open this existing file:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Replace its complete contents with the file at the same path in this ZIP, then commit to `main`.

No package.json, lockfile, Vite config, Supabase setting, API key, database migration or public asset needs to be changed.

The patch keeps the previous v6.27–v6.30 staff GLB runtime work and adds head-attention glance and listening-nod behaviour. Deploy through the existing Vercel GitHub integration. The ZIP does not represent a full repository build or a confirmed production render.
