# Changelog — CALLORIA v6.12

## Staff GLB compatibility

- Relaxed the build-time staff GLB gate: animation clips and a 15-joint minimum are no longer universal render prerequisites.
- Added support classification for animated-skinned, animated-node-transform, skinned-static-pose and static-mesh GLBs.
- Preserved existing structurally valid local GLBs, including 13-joint and no-animation models.
- Added manifest render-mode counts and per-model rig/animation metadata.
- Kept the existing Vite plugin factory, plugin name, manifest destination, asset IDs, URLs and candidate-array integration contract.
- Kept malformed container, invalid scene/mesh, geometry-budget, dependency and skin-structure checks.
