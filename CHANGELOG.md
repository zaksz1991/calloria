# v2.4 — Third-person GLB Player Character

- Adds a visible player avatar using the existing male/female agent GLBs.
- Adds a third-person follow camera driven by the existing movement controller.
- Uses real embedded idle/walk/run clips when available.
- Accepts static GLBs without pretending they have a skeletal rig.
- Adds tier-aware geometry limits and Meshopt decoding.
- Retains the original controller when no suitable avatar loads.
- Cleans up GLB resources during the existing world disposal lifecycle.
- Adds no new renderer and no additional animation frame loop.
