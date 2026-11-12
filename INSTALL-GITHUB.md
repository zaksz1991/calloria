# CALLORIA v6.25 installation

Apply this patch over the current CALLORIA branch. Add/replace these files at the repository root:

1. `public/glb-asset-lab.html` — replace the existing file with the supplied complete version.
2. `js/calloria-glb-performance-audit.js` — add this new module.

Do not replace `package.json`, `vite.config.js`, lockfiles, Supabase settings, API keys or existing gameplay modules. No database migration is required.

After deployment, open `https://calloria.vercel.app/glb-asset-lab.html`, then use **Run full asset audit**. Choose the Mobile profile first. The export button downloads a JSON evidence file. The page and batch scan require the deployed asset paths to be reachable and browser access to the pinned Three.js CDN.
