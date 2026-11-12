# CALLORIA v6.12 — Staff GLB Compatibility Repair

This is an additive build-pipeline repair for the staff-model problem reported in the Vercel build log. The v3.9 validator was treating animation clips and a 15-joint skeleton as hard requirements for every visible staff model. The log showed local models with 13 joints and no embedded animation clips, plus a receptionist model without a skin. They were therefore rejected before the browser could attempt to display them.

## What changes

The replacement keeps the existing Vite plugin API and file location, but validates whether a GLB is safe and useful to render rather than requiring every character to be fully animated.

Supported manifest render modes:

- `animated-skinned`: a skinned mesh with embedded animation clips.
- `animated-node-transforms`: animation clips that animate scene-node transforms without a skinned mesh.
- `skinned-static-pose`: a valid skinned mesh with no embedded animation clips.
- `static-mesh`: a valid unskinned character mesh in its authored pose.

The validator still checks the GLB v2 container, scene nodes, mesh primitives, POSITION accessors, triangle budget, primitive budget, skin attribute consistency, embedded dependencies and required extensions. It continues to reject malformed files, external binary/image dependencies, invalid skin references, unsupported primitive modes, excessive geometry and implausible character bounds when bounds are available.

A 13-joint rig is no longer rejected solely because it has fewer than 15 joints. Missing `Idle`/`Walk` clips no longer makes a structurally valid staff model unusable. The manifest reports animation and rig capability rather than pretending that clips exist. No skeleton or animation is fabricated.

## Installation

Replace only this file in the existing GitHub repository:

`build/calloria-cc0-staff-glb-bundle-plugin.mjs`

Keep the existing `vite.config.js`. The replacement exports the same `calloriaCC0StaffGLBBundlePlugin()` factory, retains the existing plugin name and writes the existing manifest path:

`public/assets/models/calloria-cc0-staff-manifest.json`

Keep the v6.11 `js/world-player-avatar.js`, `js/world-player-avatar-desktop.js`, and all v2.5 workstation/mobile plugin files unchanged. This repair does not replace those files or alter their four required source anchors.

## Expected build behaviour

For an existing local model that passes the new structural checks, the build preserves that file instead of refreshing it simply because it has 13 joints or lacks animation clips. Models that fail structural checks still fall back to the pinned download attempt. Network/download failures remain non-fatal and are recorded in the manifest, with unavailable models excluded from the `PRIMARY_CANDIDATES` list.

The Vercel log should now distinguish structurally compatible models from animated models, for example:

`CALLORIA v6.12 staff GLB compatibility bundle: N/5 structurally compatible, A animated, S static-pose, ...`

The exact counts depend on the actual files in the repository. Do not assume 5/5 until the next build log confirms it.

## Important limits

- No GLB files are included in this patch. It re-validates the existing five files at the same public asset paths.
- A static-pose model is visible but does not gain walking, typing or talking animation.
- A manifest entry and a bundled candidate do not, by themselves, prove that the browser runtime placed the model into the scene. Runtime placement still needs to be confirmed from the actual Vercel build and the in-game GLB status panel.
- This workspace did not contain the full current CALLORIA repository or the five real GLB files. The tests use synthetic GLB fixtures that reproduce the logged compatibility cases; they do not certify the actual asset downloads.
- No Groq, Supabase, recruitment, gameplay, camera or CSS files are changed.
