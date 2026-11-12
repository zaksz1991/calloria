# CALLORIA v6.31 — Staff Attention Gestures

This patch makes compatible static-pose staff look more attentive during idle workplace scenes.

### Behaviour
- Recognised head bones receive a very small, slow glance variation.
- A brief listening nod occurs approximately every 15 seconds, with a small synchronised neck counter-rotation.
- Arm, forearm, hand and existing posture micro-movements from v6.30 remain active.
- Only validated static-pose skinned staff are given these procedural gestures. Staff with authored GLB clips continue using those clips unchanged.
- The existing low/balanced/high idle scheduler, hidden-tab pause and visibility cache remain in effect.

The nod is an additive local quaternion offset from the captured bind pose. It is not represented as a new authored animation clip.
