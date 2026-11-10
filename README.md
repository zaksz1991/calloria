# CALLORIA v4.0 — GLB Visual Acceptance Lab

## Purpose

This is a standalone, read-only browser verification page for the real GLB files delivered by CALLORIA. It does not invent success based on a registry entry or build manifest. Each model receives a browser-render-pass only after `GLTFLoader` successfully loads the deployed file into a Three.js scene.

It was prepared after the v3.9 CC0 staff bundle patch. It deliberately detects when that bundle is missing rather than silently displaying local placeholders.

## What it checks

- v3.9 staff manifest availability and its validated/failed counts.
- Actual browser loading of each staff model listed as available by the manifest.
- Existing catalogue office GLBs: workstation desk, computer, headset and reception desk.
- GLB mesh count, skinned-mesh count, joint count, estimated triangles, materials, textures and embedded animation clips.
- Idle/Walk clips through the animation selector when those clips exist.
- Draco and Meshopt decoding using the application's pinned Three.js 0.170.0 modules.

## Install

Copy this one page into the matching public folder:

`public/glb-asset-lab.html`

Add the included test file to:

`tests/calloria-v40-glb-asset-lab.test.mjs`

No change to `vite.config.js`, `package.json`, `package-lock.json`, `main.js`, `index.html`, Supabase, or the 3D runtime is required. Vite copies public files into the production output automatically.

## Open after deployment

`https://calloria.vercel.app/glb-asset-lab.html`

The page uses jsDelivr to load the same pinned Three.js version as the application. The actual `.glb` files are fetched from CALLORIA's own deployment.

## Interpretation

- `STAFF GLBs VALIDATED AT BUILD` means the v3.9 build plugin reported structurally valid files.
- `MODELS RENDERED IN THIS LAB` counts only files that completed the GLTFLoader callback and were added to the preview scene.
- A missing manifest means the v3.9 bundler has not run successfully in that deployment, or the manifest was not published.
- An office asset 404 means the exact registry file is absent from the deployment. The page does not replace it with geometry.
- A loaded model is not automatically approved for production character use. Review dimensions, pose, proportions, textures, rig and animations before approving it in the GLB Inspector.

## Limits

The page does not alter staff placements in the live office and does not certify that staff replacements appear in the main game scene. It isolates asset availability and browser decoding from the rest of the world integration. Visual fit in the actual contact-centre scene remains a separate acceptance test.

## Verification boundary

The focused tests and syntax checks verify the static diagnostic page and its runtime contracts. They do not perform a real browser/WebGL session, download deployed GLBs, or verify the live Vercel build.
