# CALLORIA v6.30 — Staff Arm & Hand Micro-Gestures

This patch improves the idle presentation of compatible static-pose staff GLBs. Recognised arm, forearm and hand bones receive restrained oscillation layered on the existing head/neck/spine/shoulder idle. Each target is reset to its captured base quaternion before offsets are applied, so repeated updates do not accumulate rotation.

Only static-pose staff using the existing procedural idle path are affected. Models with authored animation clips continue using their existing Three.js animation mixers without additional procedural motion. The existing v6.29 low/balanced/high scheduling, visibility cache and reduced background work remain in place.

The change is conditional on bone naming. If a model's rig uses unrecognised names, its existing idle fallback remains active. Actual in-game appearance depends on each deployed GLB rig and still requires browser inspection.
