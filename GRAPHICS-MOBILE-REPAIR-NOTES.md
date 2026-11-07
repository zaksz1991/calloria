CALLORIA GRAPHICS + MOBILE REPAIR — v2

Replace these complete files in the existing CALLORIA project:
- index.html
- js/production-world.js
- performance-mobile.css (project root)

What changed:
- Removed the Meridian brand from workstation screen texture and changed the legacy label to CALLORIA OPERATIONS CENTRE.
- Added critical launch-screen layout rules directly to index.html so the old world title, duplicate entry button, badge and legacy controls cannot overlap the new game launcher even if the external override stylesheet is missing or cached.
- Made the launch screen a true full-viewport game shell on desktop and phones, with mobile portrait/landscape and safe-area handling.
- Reclassified device tiers: touchscreens and ordinary mid-range phones are no longer automatically pushed into the low-quality tier. Balanced phones get antialiasing, a 1.0 pixel-ratio target (adaptively reduced only if measured frame cost requires it), and a 34 FPS cap. Very constrained devices retain a lighter path; high-capability devices can reach 60 FPS.
- Changed repeated desk, monitor, chair and fixture components to rounded bevelled shared geometry, still instanced to keep draw calls controlled.
- Increased workstation screen texture resolution and improved texture anisotropy within device caps.
- Improved the staff geometry with articulated upper/lower arms, visible legs and shoes, facial features, hair/scarf variants, ID badges and headsets. This remains locally generated geometry, not photorealistic scanned humans or imported GLB assets.
- Reduced the height and visual dominance of the rear/side walls and adjusted the camera framing to show more of the operational floor.
- Preserved the existing initProductionWorld API, station interactions, movement callbacks, and Supabase integration files. No database, secrets, Edge Functions or Prospector files changed.

Validation in this package:
- JavaScript syntax checked with Node.js.
- Required integration IDs preserved in index.html.
- No remaining MERIDIAN / Meridian strings in the packaged UI or renderer.
- CSS brace balance and mobile media-query presence checked.
- ZIP integrity tested.

Not claimed:
- This is not a replacement for high-quality rigged GLB people or a photorealistic office asset pack.
- This package has not been rendered in a live browser or physically benchmarked on Android/iPhone devices. The adaptive renderer needs real-device observation after deployment.
- No Vercel deployment or production runtime test was performed here.
