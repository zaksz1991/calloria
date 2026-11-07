# CALLORIA — Render Quality & Mobile Performance Upgrade v3

This package supersedes the earlier graphics/mobile repair package. It contains complete replacements for the same paths and does not require new GLB assets.

## Included files

- `index.html` — full launcher shell from the previous repair; retains `/js/main.js` and the `#worldCanvas` integration.
- `js/production-world.js` — improved 3D world surfaces, rounded world architecture, workstation detail and adaptive frame-pacing controller.
- `performance-mobile.css` — full responsive stylesheet, including narrow-phone refinements.

## Changes

- Adds deterministic, locally generated floor, carpet and wood surface textures. No external images or model downloads are required.
- Uses fixed-world-size bevelled geometry for one-off architecture instead of sharp-edged boxes; the bevel does not scale into oversized corners on large walls.
- Adds instanced keyboard keycaps, pointing devices, monitor status indicators and overhead LED strips.
- Brightens floor and wall materials while retaining the existing low-cost hemisphere/directional lighting and contact-shading approach.
- Replaces the old resolution controller's JavaScript submission-time estimate with frame-pacing feedback. Resolution lowers only after sustained missed-frame pressure and recovers slowly when there is headroom.
- Retains device-tier quality selection, adaptive pixel ratio, on-demand launch preview rendering, instanced repeated assets, and mobile touch controls.
- Adds 320–480 CSS-pixel launcher refinements and isolates the WebGL canvas paint/layout area.
- Adds explicit disposal for shared geometries and local canvas textures when the world is destroyed.
- The runtime and launcher contain no `MERIDIAN` branding.

## Installation

Replace these paths in the CALLORIA repository with the files in this package:

- `index.html`
- `js/production-world.js`
- `performance-mobile.css`

The archive is a complete replacement package. Do not merge individual snippets into existing files. Preserve all unrelated repository files.

## Validation performed

- JavaScript module syntax check passed with Node's parser.
- Static integration checks passed for `#worldCanvas`, `/js/main.js`, CSS link, branding removal, surface maps, instanced workstation details, adaptive frame pacing, and the narrow-phone CSS breakpoint.
- CSS brace-balance check passed.
- ZIP integrity check passed.

## Not claimed

No full repository build, live Vercel deployment, browser visual run, physical-phone test, or measured FPS benchmark was performed. Adaptive quality reacts to browser frame pacing, but its actual results must be measured on real target devices.
