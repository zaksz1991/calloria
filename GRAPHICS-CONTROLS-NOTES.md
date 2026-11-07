# CALLORIA Graphics Controls v5

## Purpose
Add safe, user-selectable render profiles to the in-game Performance Lab. This is the next layer after the v4 diagnostics overlay: players can switch visual/rendering trade-offs without editing code or reloading the game.

## Files
- `index.html` — carried forward unchanged from the v4 package so the launcher and integration markup remain paired with the renderer.
- `js/production-world.js` — complete replacement; adds Automatic, Smooth, Balanced and Sharp profiles.
- `performance-mobile.css` — complete replacement; styles the profile selector for desktop and touch screens.

## Profiles
- Automatic: uses the device-derived tier and continues adapting resolution from observed frame pacing.
- Smooth: lowers the render-scale target and caps the target frame rate at 30 FPS (or the lower device-tier cap).
- Balanced: slightly reduces the initial render scale while retaining the device-tier frame target.
- Sharp: requests a modestly higher render scale, while keeping the hard device-pixel-ratio cap and device-tier frame-rate limit.

The profiles do not attempt to change WebGL antialiasing after renderer creation; doing so would require rebuilding the renderer and could disrupt the session. All profiles preserve existing low-device and DPR safety caps.

## Performance Lab overhead
The scene geometry/texture memory estimate is cached after its first traversal. It is no longer recalculated every time the overlay refreshes, preventing the diagnostic panel from repeatedly walking the full scene graph.

## Persistence
The selected profile is stored under `calloria.graphics-profile.v1` in browser local storage. If storage is unavailable, the selection remains active for the current page session. Existing CALLORIA gameplay saves are untouched.

## Installation
Use the package as a complete replacement set after the v4 Performance Lab package. Replace `index.html`, `js/production-world.js` and `performance-mobile.css` in the project root / matching folders. Do not mix individual files from earlier v2/v3 packages with this set.

## Validation
Static JavaScript syntax, profile-control integration, CSS brace balance and ZIP integrity were checked. A full Vite build, live browser interaction, and real-device FPS test were not run in this environment. The `Sharp` profile is a capped request, not a guarantee of higher image quality on every device.
