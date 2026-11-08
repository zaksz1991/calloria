# CALLORIA GLB-first workplace correction v2.1

This overlay targets the public `main` branch reviewed on 8 November 2026. It changes the build-time integration adapter and adds two runtime modules. It does not replace the large `production-world.js` or `main.js` files.

## Files to replace

- `build/calloria-glb-world-plugin.js`

## Files to add

- `js/glb-office-world-integration.js`
- `js/world-gameplay-mission.js`
- `tests/calloria-glb-first-world.test.mjs`

The existing `vite.config.js` already registers `calloriaGLBWorldPlugin()` and the Meshopt runtime plugin. Do not add duplicate registrations or replace `vite.config.js`.

## What changes in the game

### First-person mobile start

The player spawns at the front approach point for Agent Station 11 (`x=2.9, z=7.65`). The same position is restored whenever the player enters the floor. This is the exact approach point used by the current proximity calculation, so the USE button should become enabled on the first game frame. The player no longer has to wander around before finding a workstation.

A small shift-objective card tells the player to report to the desk, changes when the workstation is in range, and confirms after USE is tapped.

### Real GLB office assets

The layer loads the existing repository assets from `GLB_ASSET_REGISTRY`:

- `office/desks/office_desk.glb`
- `office/equipment/office_computer.glb`
- `accessories/headsets/model.glb`
- `office/reception/reception-desk.glb`

Only selected high-visibility stations are replaced. The actual computer model is placed at both monitor positions on each selected desk. Primitive furniture parts are hidden only after the corresponding GLB loads and passes validation. Remaining stations keep their instanced fallback geometry for mobile performance.

Device-tier limits:

- Low: one GLB desk and its two computer models.
- Balanced: two GLB desks, four computer models, headsets and the reception desk.
- High: four GLB desks, eight computer models, headsets and the reception desk.

The loader registers `MeshoptDecoder`. It checks dimensions, triangle count, mesh count and texture dimensions. Failed or over-budget assets remain on the original procedural fallback; failures are included in the asset status and browser console.

### Staff GLBs

The staff integration now accepts unit-scaled human meshes based on proportions, then normalizes their rendered height. It permits unskinned static GLBs at standing support positions, with subtle root movement. It does not put static/T-pose models into seated agent positions. Seated agents still require an authored seated/typing clip; compatible skeletal idle clips remain supported.

The asset-status text reports confirmed GLB staff and office object counts. It no longer claims that optimized local staff models are active when no GLB has actually loaded.

## Important visual scope

The downloaded repository assets are individual furniture, equipment and character models—not a complete office-building environment GLB. This update therefore replaces the selected desks, monitors, headsets and reception counter with actual downloaded GLBs. The floor, walls, ceiling, signage, chairs and unselected stations remain in the existing Three.js scene. A complete building/environment model would need a separate environment GLB.

## Preserve existing files

Do not replace or shorten:

- `js/production-world.js`
- `js/main.js`
- `vite.config.js`
- `package.json` or its lockfile
- Supabase files
- Any original files in `public/assets/models/`

## Verification limits

The included contract tests and syntax checks pass for this overlay. The full repository's Vercel build and live mobile rendering have not been run from this workspace. Actual assets are runtime-validated in the browser; the patch does not claim an asset is active until it loads and passes its checks.
