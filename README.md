# CALLORIA v6.19 — Department Glass Runtime Activation

This patch moves the existing CC0 glazed QA/supervisor partition integration out of the obsolete Vite source-text anchor transform and into the active production-world scene lifecycle already used by the v6.18 reception integration.

## What changes

- Adds the CC0 glass partition runtime module at `js/cc0-glazed-department-partitions.js`.
- Calls it directly with the live Three.js scene and device tier from `js/cc0-office-lobby-integration.js`.
- Waits up to seven seconds for the authored QA/supervisor glass anchors to enter the scene. It does not invent placeholder anchors or new room coordinates.
- Replaces the authored panes only after the external GLB passes validation and all replacements are prepared.
- Dispatches `calloria:glazed-partitions-ready` with load status and attaches the status to the reception integration status object.
- Disposes the added glass and restores original panes when the production world is disposed.
- Keeps the existing Vite plugin export as a no-op compatibility hook, avoiding the obsolete v3.3 source-anchor transform and its warning.
- Preserves the v6.17.1 `integrateCalloriaCC0Lobby` named export and the v6.18 greenery integration.

## Asset

The glass model is the existing CC0 1.0 glazed partition module from 3dassets.dev. Its published geometry envelope is checked before placement. Existing panes remain visible if an anchor is missing, dimensions drift, the GLB cannot load, or validation fails.

## Scope

Apply this as an overlay on top of CALLORIA v6.18. It does not replace the package manifest, lockfile, Vite configuration, production-world source, shared Supabase settings, or Groq credentials.
