# CALLORIA v6.28 — Adaptive Staff Idle

- Adds a 30 Hz update cap for procedural idle poses on static-pose staff models.
- Pauses idle pose calculations when the browser tab is hidden.
- Skips pose calculations for staff wrappers hidden directly or through an invisible ancestor.
- Keeps rest-quaternion restoration, authored animation clips, seated-staff restrictions, and the existing render loop unchanged.
- Adds runtime diagnostics for the idle update cap and visibility-aware scheduling.
