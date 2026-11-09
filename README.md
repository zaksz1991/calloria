# CALLORIA v3.3 — CC0 Glazed Department Partitions

An incremental overlay for the CALLORIA repository after v3.2. This is not a full repository snapshot.

## What changes

- Replaces the QA room's existing flat glass front with six real, framed 1.2 m glazed partition modules.
- Replaces the supervisor room's two existing flat side panes with five modules per side.
- Keeps the authored room walls, open entrances, floor plan, existing collision checks, player movement and office layout unchanged.
- Uses exact existing pane object names and measured size checks; no new room coordinates are inferred from a runtime scan.
- Loads the model asynchronously. Existing glass remains visible until every replacement panel has been prepared and committed successfully.
- Low-tier devices receive the six-panel QA front only. Balanced/high tiers receive all 16 modules.
- Maximum added geometry: 9,024 triangles at 16 × 564. The low-tier budget is 3,384 triangles.
- Emits `calloria:glazed-partitions-ready` and exposes `world.glazedDepartmentPartitionStatus`.
- Restores the original panes and disposes the GLB resources when the world is torn down.

## Included files

| File | Repository path | Action |
|---|---|---|
| `js/cc0-glazed-department-partitions.js` | same path | Add |
| `build/calloria-glazed-department-partitions-plugin.mjs` | same path | Add |
| `tests/calloria-glazed-department-partitions.test.mjs` | same path | Add |
| `vite.config.js` | same path | Merge the new Vite import and registration into the current config |

The included Vite config carries forward the saved v3.2 plugin chain and HTML build inputs. Preserve any newer project-specific additions when merging it. Do not overwrite a newer `vite.config.js` blindly.

## Asset

- Model: Glazed partition module, 1.2 m (Downtown Office Interiors)
- Runtime GLB: `https://cdn.3dassets.dev/assets/17051/v1/model.glb`
- Asset page: `https://3dassets.dev/assets/downtown-office-interiors-glazed-partition-module-0a8e7f14`
- Pack: `https://3dassets.dev/packs/downtown-office-interiors`
- Licence: CC0 1.0 Universal
- Published dimensions: 1.2 × 2.6 × 0.08 m
- Published geometry: 564 triangles, 4 materials, no animation clips
- The model is loaded through Three.js `GLTFLoader`; no additional decoder or npm package is introduced.

## Boundaries

- No SQL migration, Supabase function, auth rule, secret, payroll, KPI, promotion or workforce logic changes.
- No changes to `main.js`, `game.js`, `renderer3d.js`, `ui.js`, the staff runtime, the customer world, station interaction or player controller.
- No new collision geometry is added. Existing room boundary and movement rules remain authoritative.
- The source is hosted on the 3DAssets.dev CDN; the browser needs access to `cdn.3dassets.dev` for the upgraded panes. If loading or validation fails, the original glass remains visible.
- The source pack reports that the asset set is AI-generated. The specific module is published under CC0 1.0 Universal.

## Install through GitHub's web interface

1. Open `zaksz1991/calloria` on the `main` branch.
2. Add the two new runtime/build files and the regression test at the paths listed above.
3. Merge the import for `calloriaGlazedDepartmentPartitionsPlugin` and register it immediately after `calloriaCC0LobbyGreeneryPlugin()` in the current Vite plugin array.
4. Preserve later changes to the Vite config and every existing project file.
5. Let the existing Vercel Git integration run its normal build.

No SQL editor, Supabase dashboard, Edge Function deployment or environment-variable change is required.
