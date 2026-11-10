# v4.0.0 — GLB Visual Acceptance Lab

- Added a standalone public GLB verification page.
- Reads the exact staff manifest produced by the v3.9 build-time bundler.
- Previews actual deployed staff and existing office GLBs using Three.js 0.170.0.
- Registers both Meshopt and Draco decoders.
- Displays runtime mesh, skeleton, texture, triangle and animation diagnostics.
- Separates build-time validation from browser-rendered proof.
- Adds focused regression tests.
- Does not modify the game runtime, gameplay, onboarding, Vite configuration or package dependencies.
