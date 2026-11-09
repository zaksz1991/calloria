# v2.8

- Added a focused Vite transform for the existing staff GLB runtime.
- Registered MeshoptDecoder with the staff GLTFLoader.
- Removed the hard-coded 15-bone gate while preserving skeleton-aware animation rules.
- Allowed static mesh-only GLBs for standing positions only.
- Kept seated staff on seated animation-compatible models or the existing fallback.
- Added separate static/animated staff placement telemetry.
- Preserved existing project entry points, dependencies, renderer, world source and model files.
