# CALLORIA v6.14 — Staff GLB Runtime Activation & Placement

This release takes the staff models accepted by the v6.12 compatibility validator and enables their use in the existing browser-side staff integration. It is a focused upgrade to the 3D office, not a new renderer or a replacement for the current world.

## What it changes

- Carries the v6.12 build-validated staff manifest into the existing `js/glb-world-integration.js` transform.
- Supports both runtime candidate-array names: `PRIMARY_CANDIDATES` and `CANDIDATE_IDS`.
- Uses only staff GLBs validated and copied into the deployment by the existing build plugin.
- Uses the validated candidates by default when the GLB Inspector has no saved choice; explicit non-empty Inspector approvals still narrow the list.
- Supports four recorded modes: animated skinned, animated node-transform, skinned static pose and static mesh.
- Places static-pose models only at non-seated staff positions. They are not forced into chairs and no animation is invented.
- Uses the existing scene, renderer, animation loop and disposal path. No second renderer or animation loop is created.
- Adds actual placement IDs and placement-mode counts to the existing runtime readiness status.
- If the repository's runtime source no longer matches the checked transform contract, the build logs a warning and leaves that source untouched instead of failing Vite.

## Install

Replace one production file:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Keep `vite.config.js` unchanged. The replacement preserves the existing factory export, registered plugin name, candidate model catalogue, public manifest path and asset destinations.

For extra regression coverage, merge the included `tests/` folder into the repository's `tests/` folder. The JS fixture belongs only under `tests/fixtures/`; it is not a production runtime asset.

Do not replace `package.json`, `package-lock.json`, `js/main.js`, `js/production-world.js`, `js/world-player-avatar.js`, recruitment/assessment files, mobile CSS or `public/assets/models/` for this release.

## What to look for in Vercel

The build plugin should emit two distinct records:

1. `CALLORIA v6.14 staff GLB runtime bundle: N/5 structurally compatible ...` — build-time model validation.
2. `CALLORIA v6.14 runtime integration enabled for N bundled staff GLB(s): ...` — confirmation that the browser runtime source was transformed.

If a `Runtime integration source was not modified` warning appears, the `js/glb-world-integration.js` anchors have changed; the build can still finish, but the runtime activation has been skipped safely.

A successful transform is not proof of visual placement. After deployment, the GLB status panel should report `assetsInUse` / placed models. Static-pose assets remain still, and are only eligible for standing anchors.

## Limits

- The five real GLB files were not present in the authoring workspace. This package cannot certify their final proportions, visual quality, cultural suitability or actual live placement.
- The regression tests use synthetic GLB containers and a captured source contract.
- This release does not fix office-object loading (`GLB OFFICE OBJECTS 0`); that is a separate runtime and asset catalogue.
- Full current-repository Vite build, Vercel deployment and Android browser testing have not been performed.
