# CALLORIA v6.14 changelog

## Staff GLB runtime activation

- Connected the v6.12 validated staff manifest to the existing staff runtime integration.
- Added support for both `PRIMARY_CANDIDATES` and `CANDIDATE_IDS` runtime source generations.
- Added safe default activation of build-validated models while respecting explicit GLB Inspector selections.
- Added support for animated-skinned, animated-node-transform, skinned-static-pose and static-mesh modes.
- Restricted static-pose placements to standing/non-seated staff anchors.
- Avoided starting animation mixers when a selected model has no real clip.
- Preserved existing scene, render loop, Vite factory API, model catalogue, manifest path and disposal flow.
- Added actual placed model IDs and render-mode counts to readiness diagnostics.
- Changed unknown runtime source contracts to warn and skip the transform rather than failing Vite.
