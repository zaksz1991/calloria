# CALLORIA v6.29 — Tier-Aware Staff Idle Scheduler

This patch improves procedural static-staff idle scheduling introduced in v6.26–v6.28. Low graphics tier schedules idle pose updates at 12 Hz, balanced at 20 Hz and high at 30 Hz. Ancestor visibility is cached for 250 ms rather than traversed on every render frame. Controllers receive staggered initial update phases to reduce same-frame bursts.

The changes affect only the procedural idle layer for static-pose GLB staff. Authored GLB animation mixers, the scene render loop, movement simulation, player controls and customer systems remain unchanged. The patch does not claim a measured FPS improvement; production device profiling is still required.
