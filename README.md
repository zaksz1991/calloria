# CALLORIA v6.26 — Static Staff Idle Motion

This patch upgrades the existing build-time staff GLB runtime integration. Some accepted staff GLBs contain a valid static pose but no animation clips. When one of those assets is selected for a standing staff anchor, CALLORIA now applies restrained root-level idle movement (very small yaw/roll sway and vertical breathing).

Animated GLBs continue to use their own named clips. Seated anchors are still excluded from static-pose models. The local articulated staff model remains the fallback, and cleanup restores its visibility.

This is not skeletal animation and does not add bones, rigging, or animation clips to the GLB.
