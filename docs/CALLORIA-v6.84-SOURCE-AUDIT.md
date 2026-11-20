# CALLORIA v6.84 — GLB startup source audit

## Finding 1 — World readiness was behind two awaited asset integrations

The pre-transform replaced the local-staff ready callback with a block that called:

1. `await integrateCalloriaGLBStaff({ THREE, scene, staff, tier })`
2. `await integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier })`

Only after both calls did it invoke the world-ready callback and first render. The office integration itself loads several asset families and waits for its jobs to settle. A slow asset origin, decoder or connection can therefore delay the initial workplace setup even though the local scene and fallback meshes already exist.

**Change:** keep GLB network/decode/validation as background upgrades. Run the existing first render before scheduling either GLB integration. Run staff and office jobs independently and publish status on each completion.

## Finding 2 — Previous failure summary did not match the integration return types

The live staff integration returns a `rejected` array with model IDs and validation/load reasons. It does not consistently return a numeric `failed` field. The office integration returns `failedAssetIds`, `assetDetails` and `errors`; some failures are recorded in `failedAssetIds` or asset details even when the simple errors array does not contain a complete detail.

**Change:** normalize staff rejections and office failed IDs into the report. Use max-based counts so a record represented in both a summary count and an error list is not counted twice.

## Finding 3 — The post-transform needed an explicit “already integrated” signal

The GLB-first plugin runs as a Vite `pre` transform. The CC0 bundle plugin's `transformOfficeWorldIntegration` is a later transform and checks for `__CALLORIA_OFFICE_GLB_RUNTIME_V615__`. If the marker is present, it returns an already-patched result. If absent, it expects the original world-ready anchor; the GLB-first plugin has already replaced that anchor with the integrated staff/office bootstrap.

**Change:** mark the production-world source as already integrated by the pre-transform so the later transform does not attempt a second office bootstrap against a missing anchor.

## Finding 4 — Current plugin order is preserved

`vite.config.js` already registers `calloriaGLBWorldPlugin()`, `calloriaMeshoptRuntimePlugin()`, the static staff transform, the CC0 bundle transform and then the OJT transform. v6.84 changes the existing GLB-first plugin only. It does not add a duplicate plugin registration or replace Vite configuration.

## Scope

This is not a general 3D redesign and does not alter the GLB registry, asset licenses, validation limits, the employment/onboarding flow, Supabase, the 3D scene geometry or the user's existing model files. It makes local workplace startup independent of the duration/outcome of optional GLB downloads and makes the final diagnostics more faithful to the integration APIs.
