# CALLORIA — GLB asset audit and conservative optimization

This package adds a **manual GitHub Actions workflow**. It does not alter or overwrite the original models, the production 3D world, Vite configuration, package.json, package-lock.json, Supabase files, or existing application pages.

## What the workflow does

1. Reads every `.glb` below `public/assets/models/`.
2. Checks the GLB v2 container, embedded JSON, buffer length, external URIs, required extensions, meshes, primitives, triangle/vertex estimates, materials, textures, image dimensions, skins, joints and animation clips.
3. Writes `glb-source-audit.json`.
4. When optimization is enabled, makes copies using glTF Transform's conservative optimize + WebP texture-compression + Meshopt geometry/animation compression pipeline.
5. Does **not** decimate or reduce triangle counts. That is a separate lossy art decision and must be reviewed per character.
6. Rechecks the optimized file structure. If triangle/primitive/skin/bone/animation counts change, optimization fails, or the result saves less than 3%, the unmodified original is copied instead.
7. Writes `glb-optimization-report.json` and packages all results as a GitHub Actions artifact.

The original files remain untouched.

## Install into the repository

Copy the supplied `tools/` and `tests/` directories into the matching CALLORIA repository folders. Copy `.github/workflows/calloria-glb-asset-optimization.yml` into the same path in the repository. Do not replace existing files. This adds no dependency to the production app.

## Run without a terminal

1. Open the CALLORIA GitHub repository.
2. Open **Actions**.
3. Select **CALLORIA GLB asset audit and optimization**.
4. Select **Run workflow**.
5. Leave optimization enabled and run it.
6. When the run completes, open its **Artifacts** section and download `calloria-glb-audit-and-optimized-models`.
7. Inspect `glb-source-audit.json` and `glb-optimization-report.json` before using any optimized copy.

The workflow requires GitHub Actions to be enabled for the repository.

## What the output means

- `valid-container` means the GLB container and core JSON/buffer relationship passed these checks. It does not certify every renderer extension, visual correctness, texture quality, skeleton deformation or animation quality.
- Triangle counts are derived from glTF accessor metadata. They are asset complexity indicators, not a measured frame-rate benchmark.
- Texture RGBA memory is an estimate based on decoded image width × height × 4; actual GPU allocation varies by format, mipmaps and device.
- The optimizer never applies mesh simplification. Meshopt and WebP reduce transfer/encoded storage; they do not automatically reduce triangle count or the number of draw calls.
- Optimized output uses `EXT_meshopt_compression` where Meshopt is applied. The future production GLTFLoader must register Three.js `MeshoptDecoder` before these files are used.
- WebP output requires browser/runtime WebP support; the app's supported browser target should be verified before production rollout.

## Recommended next decision

Use the audit report to decide which assets need texture resizing, geometry LODs, draw-call reduction, or no change. Keep original GLBs as source masters. Only after report review should optimized copies be integrated into the live world.
