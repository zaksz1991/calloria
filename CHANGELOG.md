# CALLORIA v3.0

- Adds a real CC0 GLB reception/lobby scene from 3DAssets.dev.
- Replaces primitive reception counter, check-in, queue and waiting-area objects only after the new GLB passes runtime checks.
- Hides the previous single reception-desk GLB when the full lobby scene is active, preventing duplicate counters.
- Positions the starter scene at 80% scale within the reception footprint.
- Batches compatible static geometry by material and attribute layout; reports the actual resulting draw-call count.
- Loads asynchronously so the existing office can start while the lobby downloads.
- Discards the model safely if the world closes before loading finishes.
- Reports `LOBBY: LOADING`, then `LOBBY: CC0 GLB` or `LOBBY: FALLBACK`; emits `calloria:glb-lobby-ready`.
- Preserves the existing reception geometry on network, validation or source-transform failure.
- Reuses the existing Three.js scene and frame loop; no second renderer or animation loop is created.
