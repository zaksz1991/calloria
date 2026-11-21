# CALLORIA v6.88 — GUI installation

This is a cumulative overlay for the current CALLORIA repository source audited at commit `c8a48d6`. It is not a complete repository archive. It carries forward the v6.84–v6.87 GLB, third-person and RuffNeck service repairs and adds the v6.88 career-development integration.

## 1. Back up the repository

In File Explorer, make a copy of the current CALLORIA project folder. Do not delete or rename the original repository.

## 2. Extract the ZIP

Extract `CALLORIA-v6.88-CAREER-PROGRESSION.zip` into a temporary folder. Open the extracted folder and copy its `build`, `js`, `tests` folders and `vite.config.js` into the existing repository root. Choose **Replace files in the destination** when Windows asks about files with the same names.

The production replacements are:

- `vite.config.js`
- `build/calloria-career-development-v6-88.mjs`
- `build/calloria-ruffneck-service-operations-v6-86.mjs`
- `build/calloria-third-person-player-plugin.mjs`
- `build/calloria-glb-world-plugin.js`
- `js/glb-asset-health-panel.js`
- `js/glb-asset-path-fallback.js`

The ZIP also contains regression tests and a focused source fixture. Those are for verification and are not imported into the production app.

## 3. Preserve these existing repository files

Do not remove or overwrite:

- `.git`, `package.json`, `package-lock.json`, `.env` files or Vercel/Supabase configuration.
- `public/` and all existing GLB assets under `public/assets/models/`.
- `js/production-world.js`, `js/glb-world-integration.js`, `js/glb-office-world-integration.js`, `js/world-gameplay-mission.js` and the other existing application engines.
- `build/calloria-ruffneck-platform-support-v6-51.mjs`. The v6.86/v6.87 service integration imports this existing catalogue module.
- Existing v6.42–v6.50 plugin source files. They remain in the repository but are no longer registered in Vite by the updated config.

Do not add a second registration for any plugin. The supplied `vite.config.js` already registers the v6.88 career plugin and the retained v6.87/v6.86 integrations.

## 4. Commit through GitHub Desktop

Open GitHub Desktop and select the existing CALLORIA repository. Review the changed-file list. Confirm the changes are the supplied Vite configuration, plugin replacements, JS support files and tests. Enter this commit summary:

`CALLORIA v6.88 — consolidated career progression and QA evidence`

Select **Commit to main**, then **Push origin**.

Vercel should start a new deployment after the push. Check the deployment log for the first fatal error, if any. The new expected career plugin identifier is `calloria-career-development-v6-88`.

## 5. What to inspect in the deployed app

Open Workforce after completing a simulated inbound call and its wrap-up. Confirm that its voice transcript appears in the Human QA interaction list. Complete a human QA review with evidence selected from transcript lines. Low-rated criteria should create coaching actions in the Career competency passport. Complete the suggested practice and record a coach sign-off.

The promotion scenario exam should replace the old self-entered numeric score. It appears only when the existing organisation eligibility check permits an examination. The existing promotion engine still applies its three-total-attempt limit, one attempt per calendar year and 70% pass mark.

The app uses synthetic game records. This feature does not connect to production RuffNeck customer records or a real HR system.
