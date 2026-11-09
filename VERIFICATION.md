# v3.0 verification

The included eight Node tests cover the Vite post-transform, exact lifecycle injections, non-blocking asynchronous loading, idempotence, safe skip behaviour, CC0 asset metadata and runtime geometry budgets, and preservation of the existing Vite plugin chain.

All JavaScript source and test files pass `node --check`; all seven focused tests pass in the package workspace. A full Vercel production build and real-device visual/FPS test require deployment against the user's repository and CDN/network environment; they are not claimed as completed here.

The source pack's published metadata reports 32,204 triangles, 99 meshes, 7 materials, 0 textures and a 1.30 MB GLB. The runtime enforces a 42,000-triangle, 125-mesh, 12-material budget and keeps the previous reception visible if the asset fails to load or validate.
