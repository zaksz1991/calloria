# CALLORIA v7.07 — 3D Runtime Diagnostics

## Added

- A read-only runtime snapshot of the active Three.js scene.
- Separate counts for named GLB staff roots and office roots.
- Per-placement mesh counts, effective visibility, triangle counts, bounds validity, and camera-frustum intersection.
- Scene-level mesh/visible-mesh/triangle totals.
- Renderer draw calls, rendered triangles, geometry count and texture count.
- Canvas CSS and backing dimensions, pixel ratio, device pixel ratio and graphics tier.
- WebGL context-loss state.
- A compact diagnostics section embedded in the existing GLB asset report; no extra floating UI control is introduced.

## Runtime and safety boundaries

- Scene traversal runs only while the existing GLB asset report is open, on a 1.4-second refresh interval.
- The report is read-only. It does not toggle visibility, reposition models, modify loaders, change quality settings, or write to localStorage/Supabase.
- Camera-frustum intersection is reported separately from visibility. It does not claim to detect occlusion by other objects.
- The integration skips safely with a build warning if the v6.84 GLB-first marker or unique insertion anchors are absent.
- Existing asset loading and procedural fallback behavior are unchanged.

## Installation

Add the two source modules and test, then add the single import and final Vite plugin registration described in `VITE-CONFIG-ADDITIONS-v7.07.txt`.
