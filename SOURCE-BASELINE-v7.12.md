# CALLORIA v7.12 source baseline

Audited the publicly accessible `main` source on 22 November 2026.

Relevant source locations:

- `js/main.js`: Promise Control renderer builds its portfolio with `PromiseControlEngine.buildPortfolio(...)`, then writes the page into `viewRoot.innerHTML`.
  - https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
  - The inspected Promise Control block is around lines 1593–1623.
- `public/commitment-engine.js`: formal promise states include `Open`, `Complete`, and `Needs review`; due dates are stored as `dueDate` and `dueMinutes`; the maximum unsuccessful attempt count is two.
  - https://raw.githubusercontent.com/zaksz1991/calloria/main/public/commitment-engine.js
- `public/promise-control-engine.js`: existing portfolio logic links callback records using `commitmentId` and treats `scheduled`, `queued`, and `in_progress` as active task statuses.
  - https://raw.githubusercontent.com/zaksz1991/calloria/main/public/promise-control-engine.js
- `js/operations-engine.js`: callback task statuses and callback lifecycle transitions are part of the local simulation engine.
  - https://raw.githubusercontent.com/zaksz1991/calloria/main/js/operations-engine.js
- `vite.config.js`: existing plugin list ends with `calloriaTryItStudioPlugin()` and the app's main entry is `js/main.js`.
  - https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js

The Vite plugin is designed to be registered once after the last existing plugin. It transforms only `js/main.js`, checks for the current Promise Control renderer anchors and skips without partial edits if the source has changed.

This is a source overlay targeting the public source shape listed above. It is not proof that the user's deployed branch is identical. A full production build and live deployment test have not been performed because the full repository checkout was not supplied in this turn.
