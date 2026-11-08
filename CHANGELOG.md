# v1.4 — Customer behaviour and 3D avatar stage

- Adds nine grounded customer behaviour profiles to the synthetic Customer Intelligence Lab.
- Adds a GLB-powered customer avatar stage driven by the active persona and post-response customer reaction.
- Requires explicit GLB Inspector approval for customer/visitor models; no unreviewed model is shown.
- Applies model safety budgets for scale, skeleton, triangles, meshes and textures.
- Reuses the existing cached GLB loader and Meshopt runtime path.
- Keeps existing business logic, Supabase integration, main.js, customer-intelligence-engine.js and production-world.js source files untouched through version-checked Vite transforms.
- Retains the existing Customer Lab workflow if no approved compatible customer model is available.
