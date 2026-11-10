# CALLORIA v3.9.0 — Change log

- Adds build-time acquisition of five rigged CC0 1.0 staff GLBs from two published Gobkit character packs.
- Maps the models to the existing registry IDs and paths; no runtime registry path rewrite is needed.
- Validates GLB v2 structure, skeleton, JOINTS_0/WEIGHTS_0, non-empty Idle/Walk clips, primitive/triangle budgets and embedded resource references before activation.
- Adds build-time SHA-256 provenance manifest and explicit partial/unavailable reporting.
- Reorders the existing default candidate list to only the staff models which were downloaded or already locally validated.
- Preserves the v3.8.2 Draco/Meshopt runtime plugin, first-person player mode, OJT and seated-agent fallback behaviour.
- Does not claim office furniture GLB activation, live rendering, full production build or deployment success.
