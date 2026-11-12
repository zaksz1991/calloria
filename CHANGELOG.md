# CALLORIA v6.35 — Staff Eye-Gaze Morph Support

## Added
- Adds occasional, low-amplitude eye-direction changes for static-pose staff models that already contain explicit per-eye eye-look morph targets.
- Recognises the narrow ARKit-style `eyeLookUpLeft`, `eyeLookDownRight`, `eyeLookInLeft`, and `eyeLookOutRight` naming family (case and separators are normalised).
- Combines left/right eye inward and outward morphs to form anatomically consistent horizontal glances; up/down morphs are applied to both eyes.
- Uses an asynchronous 8.5–13 second cycle with a smooth rise, short hold, and release; each staff member receives an independent phase offset.
- Captures each morph's original influence, validates its index, and caps added influence at 0.075 without exceeding the normalised 0–1 range.
- Reports gaze-capable staff and discovered eye-gaze morph counts in the existing runtime status.

## Preserved
- Eye blinking and existing smile/brow expression morphs continue to operate independently.
- Authored GLB animation clips remain on their original AnimationMixer path and are excluded from procedural facial updates.
- Static-mesh and skinned static-pose staff share the same guarded morph-discovery path.
- Existing bone idle, graphics-tier scheduler, visibility gate, fallbacks, model catalogue, office integrations, renderer and animation loop remain unchanged.

## Limitation
Eye direction can move only when a deployed static staff GLB already includes compatible per-eye morph targets. This patch does not generate eyes, morph targets, facial geometry, or new animation clips. Models without these morphs retain their existing behaviour.
