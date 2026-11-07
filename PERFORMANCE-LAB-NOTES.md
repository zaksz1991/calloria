# CALLORIA Performance Lab v4

## Files
- `index.html` — retained from the current v3 package; no unrelated application markup changes.
- `js/production-world.js` — complete replacement with in-game performance diagnostics.
- `performance-mobile.css` — complete replacement with responsive Performance Lab overlay styles.

## Use
- Enter the 3D workplace and tap/click `PERF` at the top-right of the world.
- On a keyboard, press `F3` to toggle the same panel.
- Alternatively append `?perf=1` to the page URL to open it automatically.

## Measurements
- Rolling FPS and mean frame interval from requestAnimationFrame timestamps.
- Frame interval p95 over the rolling sample window.
- CPU-side update + WebGL command submission time (not GPU execution time).
- Three.js draw calls, triangles, geometry and texture object counts.
- Estimated geometry/texture memory from exposed typed arrays and image dimensions.
- Chromium JS heap when `performance.memory` is available.
- Current render scale, device pixel ratio, device tier, staff and workstation counts.

GPU execution milliseconds are not claimed: browsers do not expose a portable GPU timer without optional extensions. Scene memory is an estimate, not actual driver VRAM allocation.

## Validation
- JavaScript syntax check, CSS brace check, archive integrity and static integration checks performed.
- No full application build, browser session, Vercel deployment or physical-device benchmark performed.
