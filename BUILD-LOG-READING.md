# Reading the next Vercel build log — v6.14

Check both records:

1. **Bundle result** — `N/5 structurally compatible`, plus animated/static-pose counts. This is build-time validation only.
2. **Runtime transform result** — `runtime integration enabled for N bundled staff GLB(s)`. This confirms that the browser staff-integration source was transformed.

If the bundle count is `0/5`, inspect per-model warnings and verify the real files or network download. If it is `4/5`, the rejected model is named in the log; the other four may still be activated.

If a `Runtime integration source was not modified` warning appears, the current `js/glb-world-integration.js` no longer matches the captured v1.2+ transform contract. The build intentionally skips that transform rather than failing. The source then needs a targeted anchor reconciliation.

If both build records report success, inspect the deployed GLB status panel. It must report model IDs actually placed, not merely downloaded. Static-pose models should appear at standing support positions and will remain still.

The separate `GLB OFFICE OBJECTS` count is not changed by v6.14. This package does not claim to repair office props.
