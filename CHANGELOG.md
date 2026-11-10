# CALLORIA v3.5 changelog

## First working shift and mobile player repair

- Added Draco runtime support to the existing Meshopt-enabled staff GLTF loader.
- Added build/dev delivery for the Three.js Draco JavaScript and WASM decoder assets.
- Added a mobile first-person-only mode to prevent an unverified third-person player GLB from rendering over the contact-centre floor.
- Added desktop validation for a skinned player character with named idle and walk animations.
- Added a same-simulated-day attendance requirement for the morning or afternoon operations briefing before starting a shift.
- Routed successful shift start to the existing inbound operation view.
- Added a compact immersive HUD action to open the existing work desk and follow the employment/briefing gate.
- Reduced the first-shift tutorial card footprint on mobile.
- Added asset rejection details to the existing staff asset-status tooltip.
- Added ten focused regression tests for the v3.5 transforms.

## Compatibility

Built against the public `main` branch source inspected on 10 November 2026, including its v3.3 office plugins and the existing Meshopt pre-transform and static-staff post-transform. The patch deliberately fails the Vite transform if expected source anchors drift, rather than silently applying a partial change.
