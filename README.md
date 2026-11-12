# CALLORIA v6.23 — Staff GLB Deployment Audit

This patch extends the existing v6.22 staff-GLB bundle plugin. It does not add another renderer, animation loop, asset loader, or runtime world.

## What changes

- Records whether the existing Vite build transformed `js/glb-world-integration.js` and `js/production-world.js`.
- Preserves the exact warning text when either source transform is skipped because its checked source contract does not match.
- Emits `calloria-staff-glb-diagnostics.json` into the production build.
- Emits a self-contained `calloria-staff-glb-diagnostics.html` audit page.
- The page checks each bundled model's production URL using a `Range: bytes=0-3` request and confirms the GLB `glTF` header without intentionally downloading the complete model.
- Displays model validation state, render mode, measured world dimensions, triangle count, bones, animation clips, and deployment file availability.
- Explicitly distinguishes build validation, source transformation, deployed file availability, and actual game-scene placement. It does not report a GLB as rendered merely because it was bundled or reachable.

## After deployment

Open `/calloria-staff-glb-diagnostics.html` on the deployed CALLORIA domain. The report makes it possible to identify whether the remaining issue is model bundling, source integration, or deployed asset availability without relying only on Vercel warning text.

The existing v6.22 transform-aware GLB validation remains intact. No Supabase, Groq, package, lockfile, Vite configuration, or existing game-world file is replaced.
