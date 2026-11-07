CALLORIA performance and mobile repair package

Files in this package
- index.html — complete replacement based on CALLORIA's current main-branch launch shell. Loads the new performance-mobile.css override.
- js/production-world.js — complete replacement for the 3D workplace renderer.
- performance-mobile.css — new mobile/desktop layout override and launch-screen overlap fix.

Rendering changes
- Repeated desk, divider, screen, chair, column, plant and wayfinding geometry is GPU-instanced to reduce draw calls.
- Launch preview is rendered on demand. It no longer runs a continuous animation loop while idle.
- Gameplay render rate is capped by device tier: 24 FPS for constrained devices, 30 FPS for balanced phones, 40 FPS for balanced desktop and 50 FPS for high-tier desktop.
- Adaptive pixel ratio reduces render resolution when measured frame render cost stays high, then gradually restores it when headroom returns.
- Real-time shadows are disabled; the scene uses three inexpensive lights.
- Remote 3D staff/model downloads are removed from the floor scene. Six lightweight local staff models are created from shared geometry.
- The oversized ceiling is removed so it cannot obscure the floor preview.

Mobile changes
- Touch device quality tiering, lower pixel ratio, reduced texture anisotropy and no antialiasing on constrained hardware.
- Safe-area-aware launch layout, responsive account controls, CTA sizing and compact statistics.
- Portrait, narrow-phone, short-height and landscape-phone layouts.
- Single-column operational views, 44px minimum action targets and 16px mobile form text.
- Existing touch joystick, run and interact controls remain supported by the replacement renderer.

Installation
Replace these two existing files in the CALLORIA repository:
1. index.html
2. js/production-world.js

Add this new file at the repository root:
3. performance-mobile.css

Do not replace the rest of the project. Do not modify Supabase migrations, secrets, Edge Functions, authentication or RuffNeck Prospector objects.

Validation performed in this package
- JavaScript syntax check on js/production-world.js.
- HTML structure and required integration-ID checks.
- CSS delimiter and stylesheet-link checks.

Not represented as completed
- This package has not been built against a complete local checkout of the repository.
- No real browser, Android phone, iPhone or physical-device FPS benchmark was available in this run.
- Deployment and live-site behaviour have not been verified. A Vercel production deployment is required after replacing the files.
