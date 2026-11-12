# CALLORIA v6.27 — Articulated Staff Idle

This patch improves the idle motion of static-pose skinned staff models. When the cloned GLB contains recognised `head`, `neck`, `spine`/`chest`, or `shoulder` bones, CALLORIA applies tiny, local quaternion offsets. Rest quaternions are restored every update before the offsets are applied, preventing cumulative rotation drift.

Static-mesh models and rigs without recognised bone names retain the v6.26 root-motion fallback. Models with authored clips continue using those clips. Seated staff are not assigned static poses.

This is procedural pose motion, not a new authored animation clip or a full locomotion/typing system. Actual appearance still depends on each model's rig naming, bone orientation, runtime placement, and the production browser scene.
