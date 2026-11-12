# CALLORIA v6.33 — Static-Mesh Blink Morph Support

## Fixed
- Extends the existing blink morph-target scan to unskinned `static-mesh` staff models, not only `skinned-static-pose` models.
- Keeps morph scanning inside the existing procedural-idle gate, so authored animated GLBs do not receive a second procedural facial controller.
- Preserves strict morph-name matching, index validation, neutral influence, per-character blink timing and graphics-tier scheduling.
- Bone movement continues to require actual skeleton bones; unskinned meshes only use blink morphs they already contain.

## Scope
- One build-plugin replacement only.
- No new renderer, animation loop, dependency, asset, public runtime file, API key, database migration or Supabase change.

## Limitation
The change only enables blinking when a deployed static-mesh GLB already includes compatible eye-blink morph targets. It does not create eyelid geometry or morph targets.
