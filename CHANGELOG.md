# CALLORIA v6.31 — Staff Attention Gestures

## Added
- Low-amplitude head attention glances for approved static-pose skinned staff with a recognised head bone.
- Occasional short listening nod pulses instead of continuous head bobbing.
- Small, synchronised neck counter-rotation so the nod is shared across the head/neck chain.
- Separate runtime counters for staff and bone targets receiving attention gestures.

## Preserved
- Existing v6.27 articulated idle, v6.28 adaptive scheduling, v6.29 graphics-tier budgets and v6.30 arm/forearm/hand micro-gestures.
- Original GLB animation clips remain on the existing AnimationMixer path and do not receive procedural attention gestures.
- Original bind quaternions are restored before every local pose offset.
- No new renderer or animation loop is added. Existing visibility checks and tier update limits remain in force.
