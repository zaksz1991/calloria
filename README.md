# CALLORIA 3D World Rebuild — Phase 2

## Focus

Phase 2 improves the staff layer and render cost while keeping the Phase 1 world and its existing application contract.

- Replaces the simple face dots with visible eye whites/irises, brows, nose, mouth and headset details.
- Adds uniform plackets, collars, staff badges and lanyards.
- Uses separate pivots for heads, arms and legs, with typing, listening, standing gestures and footfall animation.
- Fills all 12 agent desks on high-capability devices; balanced and low profiles keep smaller crowds.
- Adds support staff in supervisor, IT, training and QA zones on balanced/high profiles.
- Merges character component geometry into vertex-coloured batches. This reduces per-person mesh submissions while preserving material colour differences.
- Keeps the local-only asset model; no GLB upload or remote model download is required.

## Install

This package is an upgrade to the Phase 1 replacement from the previous package. Replace only:

`js/production-world.js`

Use the complete file in this ZIP. Do not copy only selected functions. Do not replace `main.js`, `index.html`, business/workforce engines, Supabase files, migrations, or tests.

## Compatibility

The module preserves `initProductionWorld(THREE, host, callbacks)` and the existing return methods/getters, station IDs, callback names, touch control IDs and graphics profile storage key.

## Verification limits

The complete file passed JavaScript syntax validation. This package was not run against the full repository test suite, a real browser/WebGL context, a physical Android device or Vercel. No FPS gain is claimed as measured. The character geometry remains original procedural 3D geometry, not photorealistic scanned/GLB humans.
