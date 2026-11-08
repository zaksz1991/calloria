# CALLORIA Meshopt runtime compatibility fix

## Why this patch is needed

The asset optimisation workflow creates GLBs using `EXT_meshopt_compression`.
The production GLB loaders currently do not register Three.js `MeshoptDecoder`,
and the production staff integration explicitly rejects that extension. Such
optimised models therefore cannot be used by the current integration layer.

## Files

- Replace the repository root `vite.config.js` with this complete version.
- Add `build/calloria-meshopt-runtime-plugin.js`.
- Add `tests/calloria-meshopt-runtime-plugin.test.mjs`.

Keep the existing `build/calloria-glb-world-plugin.js`, all files under `js/`,
`package.json`, lockfiles, original GLB files, and Supabase files unchanged.

## What the patch changes

At build time, it adds Three.js `MeshoptDecoder` registration to both:

- `js/glb-asset-loader.js` (the inspector/shared loader)
- `js/glb-world-integration.js` (the live workplace loader)

It also changes the integration guard so Meshopt-compressed models are allowed,
while Draco-compressed files remain rejected because no DRACOLoader is configured.

The transformation is version-checked. If source anchors change, the Vite build
fails clearly instead of silently applying only part of the compatibility fix.

## Verification

Run the repository's existing test command (`npm test`) and production build
through the normal GitHub/Vercel pipeline. The added tests verify the transform.
They do not claim that every GLB has been visually or animation-tested.

## Important limit

This patch enables the application to decode Meshopt-compressed GLBs. It does
not copy the workflow artifact into the public model directory or switch the
model registry to optimised paths. The optimised models remain in the GitHub
Actions artifact until they are deliberately promoted into deployment assets.
Original GLB files remain untouched.
