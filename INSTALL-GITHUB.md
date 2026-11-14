# Installation — GitHub web interface

1. Download and extract `CALLORIA_v6_52_Platform_Support_Case_Desk.zip`.
2. Open the `CALLORIA_v6_52_Platform_Support_Case_Desk` folder.
3. In the CALLORIA GitHub repository, merge the included `build/` and `tests/` folders with the existing folders. Do not delete the older project plugins or tests.
4. Replace the repository's root `vite.config.js` with the included `vite.config.js`.
5. Commit the merged files to the `main` branch and allow Vercel to build the commit.

The ZIP includes the incremental build plugins and tests from v6.42–v6.52. It assumes the original CALLORIA repository files are still present. Do not replace `package.json`, `package-lock.json`, `.env` files, Supabase settings, `public/assets/models` or other existing project assets.

After deployment, open Workforce → RuffNeck services, select a service, and use the RuffNeck support case desk below its playbook. Opened tickets should also appear in CRM & case management. All records are local browser simulation data, not external support tickets.

If the GitHub repository already contains some of the listed versioned files, keep one copy of each file and merge without duplicating imports in `vite.config.js`.
