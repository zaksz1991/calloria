# CALLORIA v6.91 — Source baseline

Inspected against the public `main` branch on 21 November 2026.

Confirmed source points:
- `index.html` already loads `/calloria-shift-command-centre-v6-90.css` and `/js/calloria-shift-command-centre-v6-90.mjs` before `/js/main.js`. The v6.91 patch keeps both URLs unchanged.
- `js/main.js` maintains `shiftActive`, `shiftElapsedMinutes`, `agentStatus`, `shiftRecord`, `currentCall`, `activeOutbound`, `wrapUp`, `digitalActiveIds` and `digitalActiveId` in the existing save.
- `js/shift-engine.js` defines the default 08:00–17:00 plan, breaks at 10:00–10:15, 12:30–13:00 and 15:00–15:15, and the adherence rule. v6.91 mirrors those read-only rules and uses the saved custom plan where available.
- The public `package.json` reports package version `0.3.0`; the visible shell badge in `index.html` says `CALLORIA · BUILD 1.4.0`. These are different version labels, not proof of different source trees. The supplied Vercel log commit and current `main` commit can still differ; check the deployment's commit before attributing its build result to this patch.

This is a cumulative overlay, not a complete repository archive. It does not contain the full application source, model binaries, Supabase source or environment configuration.
