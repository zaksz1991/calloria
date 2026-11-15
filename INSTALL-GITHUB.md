# Install CALLORIA v6.57 through GitHub

Repository: `zaksz1991/calloria`  
Branch: `main`

This ZIP is a **cumulative upgrade overlay**, not a full export of the application repository. It contains the v6.42–v6.57 integration modules, tests and replacement Vite configuration. Keep the existing application source, public assets, package files and environment settings.

## GitHub browser workflow

1. Download and extract this ZIP on your computer.
2. Open the repository's `main` branch on GitHub.
3. Merge the included `build/` files into the repository's existing `build/` directory. Keep unrelated existing build plugins.
4. Merge the included `tests/` files into the repository's existing `tests/` directory. Keep unrelated tests.
5. Replace the repository-root `vite.config.js` with the supplied `vite.config.js`.
6. Commit the changes to `main` and let Vercel create a deployment.

Do not upload the enclosing `calloria-v6-57/` folder as a new project directory. The paths inside it are repository-relative.

## What not to change

- Do not replace `package.json` or `package-lock.json` for this upgrade.
- Do not change Supabase URL, keys, edge-function secrets or database settings.
- Do not change Groq credentials or other existing API keys.
- Do not remove the existing `js/support-router-workbench.js` or `js/routing-engine.js` files.

## After deployment

Open Customer Care, choose a discovery goal and select a product. Test both **Access / pricing** and **Product support**. Each should open the support router with that product and request category selected and a draft summary filled in. Confirm that the visitor can edit the draft, choose a language, and must actively tick the existing storage-consent box and press Submit.

The test suite and syntax checks in `VERIFICATION.md` were run locally against the included fixtures. A full production build, deployed-browser test and Vercel deployment have not been verified in this package.
