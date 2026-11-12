# CALLORIA v6.27 — Articulated Staff Idle

- Replaces single-root idle movement for skinned static-pose staff with restrained local rotations on recognised head, neck, spine/chest and shoulder bones.
- Captures each bone rest quaternion and reapplies it before every procedural offset to prevent cumulative drift.
- Keeps static-mesh and unrecognised-rig models on the existing low-amplitude root-idle fallback.
- Leaves embedded animation clips untouched and never fabricates an AnimationClip.
- Exposes separate articulated-idle and root-fallback placement counts in staff runtime status.
- Retains standing-anchor restrictions, the existing render loop, and local avatar/shadow restoration on cleanup.
