# Installation — CALLORIA v6.55

This ZIP is a cumulative overlay. It includes the previous v6.42–v6.54 build modules and tests, then adds v6.55. The replacement Vite configuration is based on the prior v6.54 cumulative configuration and appends v6.55 after it.

## GitHub installation

1. Extract the ZIP.
2. Merge its `build/` folder into the repository's existing `build/` folder.
3. Merge its `tests/` folder into the repository's existing `tests/` folder.
4. Replace the repository-root `vite.config.js` with the one in the ZIP.
5. Commit and push to the `main` branch. Check the Vercel build result before treating the update as live.

The patch transforms the existing `index.html` and `customer-care.html` at build time. Those source HTML files do not need manual edits.

## Preserved

- Existing plugin sequence through v6.54.
- Existing multi-page Vite inputs and `dist` output settings.
- Existing guest play, optional cloud account, game controls and customer-care workbench.
- The six verified RuffNeck platform links already present in Customer Care.

No package dependencies, Supabase settings, API keys, Groq keys, credentials, GLB models, or product backend/payment systems are changed.

## Scope

This is a focused experience/navigation overlay, not a copy of the full application repository. It contains only the cumulative build modules, their tests, Vite configuration and documentation. The full repository remains the source of the application itself.
