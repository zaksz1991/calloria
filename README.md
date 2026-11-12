# CALLORIA v6.16 — CC0 Ergonomic Workstation Chair Activation

## Purpose

The v6.15 office runtime already loads real desks, monitors/computers, headsets and the reception desk. The remaining workstation seating still uses the original instanced geometric chairs. v6.16 activates a real CC0 office task-chair GLB in the same production office runtime.

## What changes

- Loads the CC0 task-chair GLB from `cdn.3dassets.dev` with Three.js `GLTFLoader` and anonymous CORS.
- Validates model dimensions, triangle count, mesh count, material count, texture dimensions and floor origin before placement.
- Places chairs at the existing CALLORIA workstation coordinates and facing direction.
- Device-tier coverage: low = stations 10–11; balanced = stations 9–12; high = stations 5–12.
- Merges compatible chair meshes into material/attribute batches to keep the draw-call count low.
- Hides only the corresponding legacy chair instances after the replacement chair batch has been added successfully.
- Keeps the legacy chair instances visible if download, CORS, validation or placement fails.
- Restores those original chair instances and disposes generated geometry when the office world is disposed.
- Reports chair source, CC0 license, selected station IDs, model metrics, placement count and failure category in the existing `calloria:office-glb-status` event.
- Preserves the v6.15 Draco and Meshopt office loader setup and current v2.9/v3.8 build-transform anchors.

## Model source and licence

- Model: Office task chair — Police Station and Detective Office.
- Source page: <https://3dassets.dev/assets/police-station-and-detective-office-office-chair-task-fea6fec9>
- Runtime model URL: <https://cdn.3dassets.dev/assets/29956/v1/model.glb>
- Licence: CC0 1.0 Universal.

The model is fetched by the player's browser at runtime. It is not bundled into the repository. The source server must remain reachable and allow CORS for the chair replacement to appear. The existing chair geometry remains visible otherwise.

## Expected rendering budget

The asset metadata used by the prior v3.1 integration reports approximately 2,408 triangles per chair. Eight high-tier chairs therefore use approximately 19,264 triangles, below the 32,000-triangle chair placement cap. The runtime still measures the downloaded model and rejects it if the actual model exceeds the configured budget.

## What is not changed

- No `vite.config.js`, `package.json` or `package-lock.json` changes.
- No staff GLB build plugin changes.
- No mobile camera, assessment controls, recruitment or customer-service logic changes.
- No replacement of the existing renderer or animation loop.
- No change to the fallback workstation chairs on stations not selected for GLB replacement.

## Verification boundary

The included tests cover the pure chair policy, tier mapping, geometry budgets, fallback safety, batching contracts, status reporting and v6.15 Draco/Meshopt regressions. They do not fetch the live GLB or prove Android rendering. A full Vite production build and Vercel deployment have not been run in this workspace.
