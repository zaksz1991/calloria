# CALLORIA v7.08 — Installation

## Release type

Additive CSS repair overlay. This is not a complete repository replacement.

## Exact installation

1. Back up the current CALLORIA repository.
2. Open GitHub Desktop, select `calloria`, then choose **Repository → Show in Explorer**.
3. Extract this ZIP into a temporary folder.
4. Copy only `calloria-mobile-runtime-v6-80.css` into the repository root, beside `index.html` and `styles.css`.
5. Merge `tests/mobile-runtime-v708.test.mjs` into the repository's existing `tests` folder.
6. Do not copy the ZIP's minimal `index.html` fixture over the actual application `index.html`. It is included only to record the current stylesheet reference used for isolated verification.
7. Do not edit `index.html` or `vite.config.js`: the current public `index.html` already references `/calloria-mobile-runtime-v6-80.css` at stylesheet line 15, so creating the missing root file activates it automatically.
8. Preserve all existing source, `public/assets/`, GLB files, Supabase settings, `.env` files, Vite registrations and Vercel configuration.
9. Commit and push through GitHub Desktop.

Suggested commit:

`CALLORIA v7.08 — restore mobile runtime stylesheet`

## What the stylesheet changes

- Restores the missing stylesheet URL already included by the app shell.
- Constrains shell and view containers to the available width.
- Keeps wide operational tables scrollable inside their own containers.
- Preserves readable 16px mobile form text and touch-friendly controls.
- Keeps aptitude and practical assessment panels in one column on phones.
- Adds safe-area-aware modal and command-centre layouts.
- Moves the floating Shift Command Centre launcher above the fixed mobile bottom navigation.
- Adapts the command-centre metrics to smaller phone widths.
- Supports reduced-motion settings and short landscape touch screens.

## Validation

The included test can be run by the repository's existing `npm test` command. It checks that the linked stylesheet exists, the CSS structure is balanced, the mobile assessment and command-centre rules are present, and the safe-area and narrow-screen fallbacks are retained.

A real phone visual check and full Vite production build remain necessary after the files are pushed.
