# CALLORIA Mobile Character & Render Reliability v6

## What this package changes
- Uses the existing v5 renderer as the base; it does not replace the application architecture or touch Supabase.
- Adds distance-based character detail LOD: facial features, hair details and headset components are drawn only when the player/camera is close enough to resolve them. Main character silhouettes and clothing remain visible at all distances.
- Throttles subtle seated-agent animation updates on mobile and low-tier devices while retaining first-person movement/render pacing.
- Restores the full device-tier frame target for capable phones in Balanced and Sharp profiles (up to the existing 45 FPS high-tier mobile target); Smooth remains intentionally lower.
- Handles WebGL context-loss/context-restoration events, presents a temporary status message, and resumes the preview or immersive render loop when the context returns.
- Clears stale keyboard/joystick/sprint input when the page is backgrounded.
- Adds a Performance Lab readout for character-detail visibility, WebGL state and staff animation cadence.

## Files
- `index.html` — carried forward from v5 unchanged.
- `js/production-world.js` — complete replacement based on v5.
- `performance-mobile.css` — complete replacement based on v5 plus context-status styling.

## Installation
Replace the three files in the matching project paths. This package supersedes v5 as a complete set; do not mix files between packages.

## Validation performed
- JavaScript module syntax checked with Node.js `--check`.
- Confirmed all new context lifecycle handlers, LOD groups and diagnostic fields exist.
- CSS brace balance and ZIP CRC/integrity checked.
- Confirmed the package contains only CALLORIA frontend files and notes; no Supabase/Prospector changes.

## Not verified
No full project build, deployed browser test, physical Android/iOS test, or measured FPS benchmark was run. The LOD and animation-cadence changes are code-level optimizations; actual gains depend on browser, GPU and display.
