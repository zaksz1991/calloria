# CALLORIA v6.83 — Verification

## Source-review finding

The current `main` branch has two overlapping diagnostics implementations. The older `#calloriaGlbAudit` element is created by the OJT workplace HUD plugin. Its runtime listener expands the details element when the GLB integration reports no staff and no office objects, or reports failures. The v6.82 health panel is a separate component appended to `document.body`; before this patch it showed its button regardless of whether the player was inside the immersive 3D workplace.

That is a concrete UI defect: two competing GLB status controls can be present, and the older one is intentionally expanded in the zero-placement case demonstrated by the screenshot.

## v6.83 changes

- Hides the legacy `#calloriaGlbAudit` card so only the detailed v6.82 report remains.
- Hides the v6.82 report button outside the immersive 3D workplace.
- Uses the existing `calloria:world-immersive` event emitted by the v6.82 Vite world transform to show/hide the button and close an open report on exit.
- Observes the main `calloria-game-playing` body class as a fallback when an immersive event is missed.
- Prevents programmatic report opening while outside the 3D workplace.
- Disposes any previous panel instance and its event listeners before a new panel instance is created.
- Preserves GLB path-attempt telemetry and the actual reported load/placement counts.

## Offline verification

| Check | Result |
|---|---:|
| v6.83 lifecycle / consolidation tests | 7 passed |
| Combined v6.81 + v6.82 + v6.83 focused tests | 21 passed, 0 failed |
| JavaScript syntax checks | Passed |
| ZIP integrity | Passed |

The combined test run includes the previous path resolver and Vite-transform tests as well as the new immersive lifecycle tests. The tests use a browser-DOM test double; they do not constitute a real phone-browser test.

## Not verified here

- Full repository `npm run build` and full repository test suite: not run; no complete current source checkout or installed project dependencies were available in this validation workspace.
- Vercel deployment: not run.
- Physical Android/iPhone layout: not run.
- Real production GLB download, parse, validation, and visible placement: not run.

v6.83 consolidates diagnostics only. A successful build and phone acceptance pass are still required, and any asset failure remains an open issue until the runtime report identifies the actual error and the loaded/placed counts change.
