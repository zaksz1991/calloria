# CALLORIA v6.28 — Adaptive Staff Idle

This patch builds on v6.27 articulated staff idle and reduces the amount of procedural pose work performed for static-pose staff. Procedural idle poses are recalculated at a maximum of 30 Hz rather than on every render frame. Controllers pause while the browser document is hidden or while the staff wrapper or any of its ancestors is invisible. Authored GLB animation clips are unaffected.

The cap applies only to the small procedural idle layer; it does not change the Three.js render loop, global frame rate, character movement, customer animation, or simulation time. The patch does not claim a measured FPS improvement; actual performance depends on the production scene and devices.
