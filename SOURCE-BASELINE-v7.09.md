# Source baseline — v7.09

Audited against public GitHub `main` on 22 November 2026.

- `js/main.js`: contains `renderView()` with one final `saveState();` / `function openModal(html) {` boundary.
- `build/calloria-first-shift-gameplay-plugin.js`: injects `__CALLORIA_FIRST_SHIFT_GAMEPLAY_EVENTS_V231__` and dispatches shift-started, inbound-call-connected and inbound-case-saved events.
- `build/calloria-ojt-glb-activation-plugin.mjs`: injects `__CALLORIA_OJT_CROSS_INDUSTRY_V37__`, four OJT modules, trainer review, workstation allocation, briefing gate and firstWorkingShift record.
- `vite.config.js`: registers First Shift Gameplay before OJT, and existing OJT before the final visitor hub / Try It Studio plugins. v7.09 is registered after Try It Studio as an `enforce: 'post'` transformer.

Useful sources:
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-first-shift-gameplay-plugin.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-ojt-glb-activation-plugin.mjs
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js

Important: this baseline is the public main source, not a user-provided local working tree or a verified Vercel build artifact. The plugin skips with a Vite warning if one of the upstream markers or exact render anchors is not present.
