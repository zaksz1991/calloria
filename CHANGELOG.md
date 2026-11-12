# CALLORIA v6.32 — Staff Eye-Blink Morph Support

## Added
- Subtle procedural eyelid blinks for static-pose skinned staff GLBs that expose recognised eye-blink morph targets.
- Supports common Blender/ARKit-style names including `Blink`, `Blink_L`, `Blink_R`, `eyeBlinkLeft`, `eyeBlinkRight`, `EyesClosed` and related normalised variants.
- Per-character blink period and phase offsets prevent groups of staff from blinking in synchrony.
- Preserves each morph target's original neutral influence and validates indices before writing.
- Adds separate runtime diagnostics for staff with blink morphs and total blink morph targets.

## Preserved
- Authored GLB animation clips remain on their original `AnimationMixer` path and are not given procedural blink updates.
- Static-pose staff without recognised blink morphs retain their existing bone-aware or root-idle behaviour.
- Existing attention, listening-nod, articulated idle, arm/hand micro-gesture and graphics-tier scheduling remain intact.
- No extra renderer, animation loop, dependency, API key, database migration or public asset is added.

## Limitation
Only staff GLBs that actually contain compatible eye-blink morph targets can blink. This patch does not fabricate facial geometry or claim that models without blink morphs are animated at the eyelids.
