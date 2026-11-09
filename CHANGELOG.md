# CALLORIA v3.1 — Ergonomic Workstation Chairs

## Added

- CC0 office task-chair GLB integration for the established 12-station CALLORIA workplace.
- Device-tier coverage aligned with existing GLB desk rows: 2 chairs on low, 4 on balanced, 8 on high.
- Geometry inspection and validation for dimensions, floor origin, triangles, mesh/material counts and textures.
- Compatible mesh batching by material and attribute signature.
- Lifecycle-aware removal and restoration of the previous chair instances.
- Explicit `CHAIRS: LOADING`, `CHAIRS: CC0 GLB` and `CHAIRS: FALLBACK` reporting and a `calloria:glb-chairs-ready` event.
- Focused regression tests for the v3.0 transform anchor, source safety, plugin order and status contract.

## Preserved

- v3.0 reception/lobby and all earlier Vite plugins.
- Existing gameplay, staff GLBs, desk/monitor/headset coverage and office layout.
- Existing chair geometry as the runtime fallback.
- Existing application, Supabase and authentication boundaries.

## Not claimed

This overlay's tests do not substitute for a full repository production build, live CDN fetch, browser scene render or device-tier visual review.
