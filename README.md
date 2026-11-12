# CALLORIA v6.33 — Static-Mesh Blink Morph Support

This patch fixes a coverage gap in v6.32: its blink-morph discovery was nested under a skinned-character check. Some unskinned GLB characters can still carry morph targets, so their existing eyelid morphs were never discovered.

The updated traversal scans both `skinned-static-pose` and `static-mesh` staff models. It only applies procedural blinking to models without authored animation clips and only when an existing morph target has a recognised eye-blink name. Actual bone motion remains restricted to skeleton bones.

See `INSTALL-GITHUB.md` for the single-file replacement path and `VERIFICATION.md` for test results.
