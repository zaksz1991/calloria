# CALLORIA v3.1 — Ergonomic Workstation Chairs

This is an incremental overlay for the CALLORIA v3.0 real reception/lobby baseline. It replaces only the primitive chair components at the same GLB workstation station ranges already selected by device tier. Other office zones, customer areas, workstations, staff, gameplay and simulation systems remain unchanged.

## Package contents

| Package file | Repository path | Action |
|---|---|---|
| `build/calloria-ergonomic-office-chairs-plugin.mjs` | same path | Add |
| `js/cc0-office-chair-integration.js` | same path | Add |
| `tests/calloria-ergonomic-office-chairs.test.mjs` | same path | Add |
| `vite.config.js` | same path | Replace with included v3.1 merged version |

## Installation

1. Extract this ZIP into the CALLORIA repository root.
2. Add the supplied `build/`, `js/` and `tests/` files at the listed paths.
3. Replace the root `vite.config.js` with the included file. It retains the v3.0 plugin chain and appends v3.1 after the lobby transformation.
4. Run the focused test with the repository's installed Node.js: `node --test tests/calloria-ergonomic-office-chairs.test.mjs`.
5. Run the repository's normal production build, then deploy the resulting build through the existing deployment workflow.

If your current `vite.config.js` contains changes made after the v3.0 baseline, preserve those changes and merge only the v3.1 import and plugin registration. The chair plugin must run after `calloriaCC0OfficeLobbyPlugin()`.

## Expected coverage

The replacement follows the existing 12-station device-tier ranges:

| Device tier | Workstation IDs receiving real GLB chairs |
|---|---|
| Low | 10–11 (2 chairs) |
| Balanced | 9–12 (4 chairs) |
| High | 5–12 (8 chairs) |

The rest of each tier retains the current chair presentation. The module uses the fixed station coordinates and existing chair anchor (`z + 1.36`) from the production workplace; the model's authored front is rotated toward the workstation.

## Runtime safety

- Model loading is asynchronous and does not block the first scene render.
- GLB dimensions, mesh/material counts, triangle count, floor origin and texture size are validated before any legacy chair instances are hidden.
- Repeated chair geometry is merged by compatible material/vertex layout to reduce draw calls.
- The combined placed-chair budget is capped at 32,000 triangles.
- A failed request, invalid model, changed source anchor or unsupported asset structure leaves the original chairs in place.
- Disposing the workplace removes replacement geometry and restores the original instanced chair transforms.
- No new Supabase migration, Edge Function, secret, environment variable, npm package, external AI service, microphone capture or customer data access is introduced.

## Preserve existing project files

Do not replace `package.json`, `index.html`, `main.js`, `game.js`, `production-world.js`, `glb-office-world-integration.js`, existing GLB assets, Supabase functions, migrations, or any other phase modules with older snapshots. This ZIP is an overlay, not a full CALLORIA repository snapshot.

## Network requirement

The chair is downloaded from the source's CORS-enabled CDN at runtime. A successful build does not prove that the live browser can fetch the asset. If the CDN is blocked or unavailable, CALLORIA keeps its original chairs and reports `CHAIRS: FALLBACK`.
