# CALLORIA v7.08 — Verification

## Automated checks

- 12 focused regression tests pass.
- The test suite verifies the current app-shell stylesheet reference, balanced CSS blocks, mobile-width containment, assessment stacking, input sizing, table scroll containment, Shift Command Centre launcher clearance, safe-area-aware command panel, modal/toast behavior, narrow phone fallback, landscape touch support and reduced motion.
- ZIP integrity checked after packaging.

## Not verified

- Full repository `npm test` (the complete repository source is not included in this overlay workspace).
- Full Vite build.
- Vercel deployment / HTTP 200 for the restored stylesheet.
- Physical Android or iOS browser rendering.

## Expected runtime result

The production HTML already references `/calloria-mobile-runtime-v6-80.css`. After the new root CSS file is pushed, that URL should no longer return 404. The overlay is intended to reduce mobile overflow and prevent the floating Shift Command Centre launcher from occupying the same bottom area as the fixed mobile navigation.
