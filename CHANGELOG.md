# v6.16 — Office Chair GLB Activation

- Integrated a CC0 ergonomic task-chair model into the existing office GLB runtime.
- Added tier-aware chair placement for 2 / 4 / 8 workstation positions.
- Added geometry, material, texture, floor-origin and total-triangle validation.
- Batched compatible chair geometry to limit draw calls.
- Kept original chair instances visible until validated replacements are placed.
- Added cleanup and fallback restoration during world disposal.
- Added per-chair source, licence, placement and failure diagnostics.
- Preserved v6.15 Draco and Meshopt configuration and existing Vite source anchors.
