# CALLORIA v7.08 — Changelog

## Fixed

- Restored the root stylesheet already referenced by the public app shell: `/calloria-mobile-runtime-v6-80.css`.
- Prevented mobile shell, view and card containers from forcing horizontal page overflow.
- Kept wide tables within their own horizontal scroll regions.
- Standardised phone form controls to readable 16px text and usable touch height.
- Reinforced one-column assessment layout, answer selection sizing and full-width continuation controls.
- Made modal, command-centre and toast positioning safe-area aware.
- Moved the floating Shift Command Centre launcher clear of the fixed mobile bottom navigation.
- Added 3-column and 2-column command metric breakpoints, with a 1-column fallback on very narrow phones.
- Added reduced-motion and short landscape touch-device handling.

## Preserved

- No JavaScript, game logic, assessment scoring, profile data, local saves, cloud saves or API behavior changed.
- No Supabase migration or environment-variable update.
- No edits to `index.html`, `vite.config.js`, `vercel.json` or GLB assets.
