# Changelog — v6.10

## Fixed
- Disabled the unverified player avatar mesh so it cannot cover the phone camera.
- Added a touch-device first-person camera guard after the third-person world transform.
- Repositioned the assessment action row above the fixed mobile navigation dock.
- Added automatic reveal/scroll for enabled aptitude and practical assessment Continue/Submit buttons after an answer is selected.
- Increased assessment answer cards and CTA minimum touch dimensions.
- Corrected mobile one-column layout, content gutters, horizontal overflow, safe-area spacing, forms, dialogs, tables, toasts, and navigation targets.
- Added dynamic visual viewport sizing for orientation and browser-toolbar changes.

## Preserved
- Existing recruitment assessment answers and state transitions.
- Existing `data-action` delegated click handling.
- Existing GLB staff/office asset loading; only the unverified player body is disabled.
- Existing desktop third-person camera branch, where an active player avatar is still enabled.
