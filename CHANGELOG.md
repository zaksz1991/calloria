# CALLORIA v6.34 — Staff Facial Expression Morphs

## Added
- Adds a restrained, asynchronous facial micro-expression controller for static-pose staff GLBs.
- Recognises existing named smile, mouth-dimple and brow-raise morph targets.
- Applies a slow rise/hold/release envelope with per-character timing offsets so staff do not change expression simultaneously.
- Caps added influence at 0.12 for smile/dimple morphs and 0.055 for brow-raise morphs, while respecting each morph's remaining range.
- Reports expression-capable staff and discovered expression morph counts in the existing runtime diagnostics.

## Preserved
- Existing blink morphs continue to run independently.
- Authored GLB animation clips remain untouched and excluded from procedural facial updates.
- Bone movement remains restricted to actual recognised skeleton bones.
- Existing graphics-tier scheduling, visibility checks, staff fallback behaviour, model catalogue, and office integrations remain unchanged.

## Limitation
This only animates compatible morph targets already present in deployed GLB assets. It does not create facial geometry, blend shapes, or new animation clips. Assets without recognised morphs retain their existing behaviour.
