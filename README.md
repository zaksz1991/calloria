# CALLORIA v6.18 — Reception Lobby Greenery Runtime Activation

Activates the existing CC0 greenery integration against the current v6.17.1 lobby lifecycle instead of relying on brittle string anchors from the legacy v3.2 Vite transform.

The patch preserves the required `integrateCalloriaCC0Lobby` compatibility export, loads greenery before lobby geometry batching, reports a dedicated greenery-ready event, and disposes the greenery lease with the lobby scene. The Vite plugin's import and invocation remain valid but its old transform is disabled.

Plant placement remains intentionally conservative: only named, dimension-validated planter nodes in the lobby GLB are used. No synthetic coordinates or arbitrary placements are introduced.
