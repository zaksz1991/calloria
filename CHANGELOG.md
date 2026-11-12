# Changelog — v6.18

- Activated the CC0 lobby greenery integration directly in the v6.17.1 lobby GLB lifecycle.
- Kept the `integrateCalloriaCC0Lobby` export required by `production-world.js`.
- Removed reliance on legacy Vite transform anchors that no longer matched the active lobby implementation.
- Added lifecycle cleanup for plant GLB resources and a `calloria:glb-greenery-ready` event.
- Kept authored-planter-only placement and the original lobby fallback behavior.
