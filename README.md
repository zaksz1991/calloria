# CALLORIA 3D World Rebuild — Phase 3

## Focus

Phase 3 is a visual world-dressing and material-quality pass built on the Phase 2 replacement. It keeps the world API and station callbacks intact.

- Adds tileable wood, carpet and plaster textures generated locally at startup.
- Adds window framing, ceiling acoustic rafts, service rails, HVAC diffuser detail and floor wayfinding inlays.
- Dresses agent desks with computer towers, cable trays, IP phones, keypads, webcams, writing mats, mugs and paper stacks.
- Completes training-room seating and adds additional QA/supervisor consoles.
- Adds IT service counter, printer and network patch panel detail.
- Adds a staff-lounge kitchenette, water dispenser and coffee machine.
- Adds reception waiting chairs and access readers.
- Adds safety equipment, exit marker, briefing and service-standard boards, and department wayfinding.
- Uses GPU instancing for repeated static details and does not fetch remote models or textures.

## Install

Replace only `js/production-world.js` with the complete file in this package. This is the next sequential replacement after Phase 2. Do not copy selected snippets. Do not replace `main.js`, `index.html`, gameplay/workforce engines, Supabase files, migrations, or tests.

## Compatibility

The module retains `initProductionWorld(THREE, host, callbacks)`, station IDs, callback names, existing touch control IDs, graphics profile persistence, and the existing world return interface.

## Visual limits

This remains a procedural Three.js environment. It does not introduce photorealistic GLB characters or scanned architectural assets. It adds material texture and scene dressing while keeping the no-upload, no-remote-asset approach.
