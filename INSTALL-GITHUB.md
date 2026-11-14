# Installation — CALLORIA v6.56

This ZIP is a cumulative build overlay, not the complete CALLORIA repository. It includes the v6.42–v6.55 integration modules and tests, the new v6.56 plugin and test, and a Vite configuration registering the modules in sequence.

## GitHub installation

1. Extract the ZIP.
2. Merge the included `build/` folder into the repository's existing `build/` folder.
3. Merge the included `tests/` folder into the repository's existing `tests/` folder.
4. Replace the repository-root `vite.config.js` with the one in this ZIP.
5. Commit and push to `main`.
6. Check the Vercel deployment result before treating the changes as live.

No manual changes to `index.html` or `customer-care.html` are required. The Vite plugins add the guide at build time and update the landing-page discovery route.

## Important integration note

The public `main` branch Vite configuration checked while preparing this package registered integrations through v6.53. It did not yet register v6.54 or v6.55. Therefore, do not upload only the new v6.56 plugin. Use the replacement `vite.config.js` and all included build modules so the cumulative chain is registered.

## Preserved

- Guest-first CALLORIA launch and optional cloud-save account.
- 3D game and lightweight mode entry controls.
- Existing customer-care assistant, topic prompts, case creation and case tracking.
- Existing six official RuffNeck product destinations.
- Existing Supabase settings, Groq integration, API keys, packages, GLB assets and product/payment backends.

## Scope

The discovery guide only recommends destinations and prepares a draft question. It does not collect leads, store visitor activity, create accounts, submit questions automatically, take payment or promise product availability. Product access and transaction flows remain on the official RuffNeck platforms.
