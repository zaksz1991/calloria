# CALLORIA v3.8.0 — GLB Runtime Visibility & Asset Proof

## Why this release exists

The 3D floor has been reporting a reassuring local-model status even when the actual GLB callback reports zero placed staff. The current `main.js` says `OPTIMISED LOCAL STAFF MODELS ACTIVE` whenever `result.loaded` is zero. That text does not distinguish locally generated fallback meshes from authored GLB assets.

## Changes

- Replaces the misleading zero-load message with `NO GLB MODELS LOADED · FALLBACKS ONLY`.
- Normalises the combined staff and office GLB placement counts and publishes a single `calloria:glb-assets-ready` event for the in-world panel.
- Adds a compact, mobile-sized 3D asset audit panel to the immersive HUD.
- Shows separately: staff GLB placements, office GLB placements, fallback count, device tier, rejected staff candidates, office load errors and model IDs reported as in use.
- Displays a clear timeout state when the world never reports GLB readiness.
- Links to the existing Asset Inspector.
- Retains the v3.7.2 Draco + Meshopt decoder wiring, low-tier GLB workstation plan, first-person-only avatar adapter and OJT gating.
- Makes asset count formatting safe against invalid numeric values.

## Scope boundary

This is an observability and truthful-status release. It does not include new binary GLB files, manufacture missing models, alter the model registry, or certify visual quality. The repository's asset-gap report lists desk, computer/monitor, reception desk and headset as existing office GLB categories; it does not list staff character GLBs among those confirmed categories. Actual character and office model placement must be judged from the runtime audit after deployment.
