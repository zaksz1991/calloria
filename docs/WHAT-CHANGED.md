# v6.93 change map

`js/customer-continuity-engine.js`
- Bumps continuity state version to 6.93.0.
- Adds explicit open-status classification and closed-status precedence.
- Corrects repeat-customer threshold.
- Preserves null/unknown numeric evidence.

`build/calloria-customer-recovery-insights-v6-93.mjs`
- Adds a strict Vite post-transform to the Customer 360 continuity panel.
- Computes recent repeat, cross-channel, open-follow-up, sentiment and QA signals.
- Renders responsive, read-only recovery guidance.
- Uses one-time transform marker to prevent duplicate injection.

`vite.config.js`
- No replacement supplied. Apply the two exact additions in `VITE-CONFIG-ADDITIONS-v6.93.txt`.

`index.html`
- No change required.
