# CALLORIA v6.30 — Staff Arm & Hand Micro-Gestures

Extends the existing static-pose staff idle layer with very small, mirrored upper-arm, forearm and hand movement when a compatible named bone exists in the GLB skeleton.

- Recognises common Mixamo-style names and common left/right aliases for upper arms, forearms/lower arms and hands.
- Keeps amplitudes deliberately low (0.006–0.012 radians) to avoid broad body motion.
- Restores each bone's captured base quaternion before applying each idle pose, preventing cumulative rotation drift.
- Applies only to static-pose staff already receiving procedural idle. Authored GLB clips are not modified.
- Adds micro-gesture staff and target counts to the existing runtime status data.
- Retains v6.29 graphics-tier update rates, visibility caching, phase staggering and hidden-tab pause behaviour.

This does not create skeletal clips or guarantee that every third-party rig contains the recognised bone names. Unsupported rigs retain their existing posture/root fallback.
