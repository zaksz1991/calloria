# CALLORIA GLB Inspector deployment fix v1.1

## Purpose

This is a narrow deployment correction for the existing inspector and GLB model files. It fixes two confirmed problems in the current public `main` branch configuration:

1. `vite.config.js` has `publicDir: false`, so Vite does not copy `public/assets/models/` into `dist/assets/models/`.
2. The multi-page build input list does not include `asset-inspector.html`, so the standalone inspector is not guaranteed to be emitted as a production entry.

## Apply

1. Extract this ZIP.
2. In the CALLORIA repository, replace the root `vite.config.js` with the included complete file.
3. Copy `tests/glb-inspector-deployment-contract.test.mjs` into the repository's existing `tests/` directory.
4. Keep the existing `package.json`. Do not replace it with the `package.json` from the earlier GLB Inspector overlay; that earlier overlay had dependency versions and project metadata that do not match the current repository `main` branch.
5. Keep all existing game files, `js/production-world.js`, the current GLB files, Supabase files and application modules unchanged.

## Expected build output

After a successful Vite build:

- `dist/asset-inspector.html` exists.
- `dist/assets/models/characters/agents/female-agent.glb` exists.
- `dist/assets/models/characters/agents/male-agent.glb` exists.
- The other files under `public/assets/models/` are copied to the matching paths under `dist/assets/models/`.

Open `/asset-inspector.html` on the deployed site and run the sequential compatibility scan. Export the JSON report after it completes.

## Scope and verification

This update does not yet swap GLB models into the live 3D workplace. It makes the inspector and model binaries available to the browser so the models can be measured before gameplay integration. It does not replace `js/main.js` or `js/production-world.js`.

The included contract tests check the deployment configuration and the 16 registered GLB paths. A full repository build and regression run must still be performed in the CALLORIA project after the files are applied.
