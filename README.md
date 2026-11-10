# CALLORIA v3.5.1 — Production Build Anchor Repair

This is a focused hotfix for the Vercel production build failure reported on 10 November 2026 at commit `96649f9`.

## Root cause

The v3.5 Vite plugin attempted to match an entire multi-line `try/catch` and loop-closing block in `js/glb-world-integration.js`. That formatting-sensitive anchor was not present in the source as seen by the last build transform, so the plugin intentionally stopped the build rather than applying a partial edit.

The plugin also omitted the two leading spaces used by the current `js/main.js` shift-start and open-work-view statements. Once the staff transform was passed, those mismatched anchors would have caused the same kind of build failure later in the same plugin.

## Repair

- Staff Draco cleanup now anchors to the unique `if (!loadedModels.size)` completion guard, not the whole catch/loop text.
- The shift-start and work-view anchors now match the current `main.js` indentation from commit `96649f9`.
- The replacement preserves the existing v3.5 staff decoder, touch first-person, briefing-gated shift and direct inbound work-desk behaviour.
- The transform remains fail-fast if its actual source contract drifts elsewhere.

## Files

Replace these two files only:

- `build/calloria-first-working-shift-v3-5-plugin.mjs`
- `tests/calloria-first-working-shift-v3-5.test.mjs`

Do not replace `vite.config.js`, `package.json`, application files, GLB files or database migrations with this hotfix. The current `vite.config.js` already registers the v3.5 plugin.

## Verification

- Plugin JavaScript syntax: passed.
- Focused v3.5.1 regression suite: 12 passed, 0 failed.
- ZIP integrity: checked.
- Full repository `npm test`: not run in this isolated patch workspace.
- Full Vite production build: not run against the full repository in this workspace.
- Vercel deployment: not performed or claimed.
