# CALLORIA GLB Production Integration v1.2

## What this package does

This package consolidates the missing inspector/deployment layer and adds a gated first-stage GLB character integration.

- Enables Vite to copy `public/assets/models/` into `dist/assets/models/`.
- Adds `/asset-inspector.html` as a production build entry.
- Registers the 16 GLB files already present in the repository.
- Adds live preview, geometry, materials, textures, skeleton, bone, animation and dimension inspection.
- Requires explicit local approval for a character before the live workplace can use it.
- At runtime, only approved agent models with a usable skeleton, human-scale dimensions, acceptable complexity and a matching named idle/seated animation can replace existing local staff.
- Keeps every non-compatible or unapproved character on the existing local staff implementation.
- Adds the integration at build time through a version-checked Vite transform. The source `js/production-world.js`, `js/main.js` and all gameplay/business files remain unchanged.

## Apply to the current `main` branch

1. Extract this ZIP.
2. Copy the included `asset-inspector.html` to the repository root.
3. Copy the included `build/`, `js/`, `styles/` and `tests/` folders into the repository, merging with the existing folders.
4. Replace the root `vite.config.js` with the complete included file.
5. Keep the existing `package.json` and lockfile. Do not replace dependency versions. The repository already declares Three.js and Vite.
6. Keep all 16 existing model files in `public/assets/models/` exactly where they are.
7. Do not replace `js/main.js`, `js/production-world.js`, existing Supabase files, or any current application screens.

## Inspector and model approval

After a successful deployment, open `/asset-inspector.html`.

1. Preview `male-agent.glb` and `female-agent.glb` first.
2. Run the compatibility scan.
3. Review each agent's visual appearance, dimensions, geometry, skeleton and animation clips.
4. Only click **Approve for workplace** for models that are visually suitable for CALLORIA and have appropriate animation clips.
5. Approval is stored in that browser's local storage. It is not a server-side or organisation-wide approval.
6. Return to the simulator and reload the workplace. The runtime reads the approved IDs from the same browser profile.

The initial runtime supports named idle/standing clips for standing staff and named sitting/typing/work clips for seated staff. Models without the required pose clip remain unused and the original local character stays visible.

## Performance gates

At runtime the integration checks:

- Rigged mesh and skeleton, with at least 15 bones.
- Human-scale dimensions (height 1.0–2.6 scene units, width 0.2–1.35, depth 0.12–1.35).
- Triangle limits: 45,000 low tier, 90,000 balanced tier, 150,000 high tier.
- At most 90 meshes.
- Maximum replacement counts: 2 on low tier, 4 on balanced tier and 6 on high tier.
- Texture edge no greater than 4096 pixels.
- No required Draco or Meshopt compression extension until matching decoders are configured.

These are initial safety limits, not a promise of a particular frame rate. Actual device profiling remains required.

## Existing source compatibility

The Vite plugin expects three exact anchors in the current `js/production-world.js`: the original asset-ready callback, staff update call and dispose sequence. If that file has materially changed, the build stops with an explicit error rather than silently producing a partially integrated game. This protects the existing game logic from an unverified rewrite.

## Verification

The included tests cover the 16 asset paths, Vite public copying, inspector entry, explicit approval, loader imports and version-checked world injection. They do not replace a real production build or browser test. After applying, run the repository's normal checks and verify `/asset-inspector.html`, the model URLs and the workplace on desktop and a mid-range phone.
