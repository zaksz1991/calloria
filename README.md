# CALLORIA v6.24 — GLB Acceptance Fit Validation

This is a targeted upgrade to the existing public GLB Asset Acceptance Lab. It makes the preview scale comparable to the production placement policy rather than scaling every asset to an arbitrary display height.

## What changes

- **Production fit:** office assets use the same maximum placement envelopes as the runtime loader. Models are uniformly scaled to fit inside those dimensions; proportions are not stretched.
- **Natural asset size:** shows the GLB at its authored dimensions.
- **Standing staff:** displays character models against a 1.72 m standing reference height.
- **Measurement report:** lists original and preview dimensions, scale factor, fit rule, mesh count, skeletons, joints, triangles, materials, textures and animation clips.
- Changing preview mode reloads the selected deployed GLB and uses a load token so an older request cannot replace the current selection.

The page remains an independent acceptance tool. It does not claim that models are already placed in the production game scene, and it does not modify gameplay, production world code, Vite configuration, dependencies, Supabase or model binaries.

## URL after deployment

`https://calloria.vercel.app/glb-asset-lab.html`

The page requires access to jsDelivr for the pinned Three.js 0.170.0 modules. Actual GLB files are fetched from the CALLORIA deployment.
