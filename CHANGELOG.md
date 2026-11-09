# CALLORIA v3.3 changelog

- Adds the CC0 Downtown Office Interiors glazed partition module (564 triangles).
- Replaces the existing QA flat front pane with six framed glass modules.
- Replaces the supervisor office's two flat side panes with five modules per side.
- Keeps original panes visible until all model placements are ready.
- Validates source model bounds, mesh/material/texture counts, static geometry and triangle limits.
- Applies a reduced six-module layout on low-tier devices and a 16-module layout on balanced/high tiers.
- Leaves player movement, openings, collision checks, room boundaries, existing desks, agent seats and all business logic unchanged.
- Adds status event/getter and world-lifecycle cleanup.
- Adds fail-closed Vite source transforms and regression tests.
