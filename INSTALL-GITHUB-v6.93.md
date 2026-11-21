# CALLORIA v6.93 — installation guide

## Release type

Targeted cumulative overlay for the current public `main` source structure. It is not a complete repository replacement. It does not replace `index.html`, `package.json`, the Supabase project, environment variables, GLB assets or existing v6.89–v6.92 modules.

## Files to add or replace

Replace the existing file:

- `js/customer-continuity-engine.js`

Add the new build plugin:

- `build/calloria-customer-recovery-insights-v6-93.mjs`

Add the tests:

- `tests/customer-continuity-engine-v693.test.mjs`
- `tests/customer-recovery-transform-v693.test.mjs`

## Vite registration

Open `vite.config.js` in GitHub's web editor or your normal file editor.

1. Add the import shown in `VITE-CONFIG-ADDITIONS-v6.93.txt` beside the existing build-plugin imports.
2. Add `calloriaCustomerRecoveryInsightsPluginV693(),` immediately after `calloriaCareerDevelopmentPluginV688(),` in the plugins array. The new transform must run after Career Development because both transform `js/main.js`.
3. Preserve every existing plugin registration. Do not register v6.93 twice.

No `index.html` modification is required. The feature is a build-time integration into the existing Customer 360 continuity panel.

## What changes in the game

When a customer continuity panel is shown during an interaction, it now includes a read-only Customer Recovery Brief. It identifies repeat contacts within 24 hours, cross-channel contacts within 72 hours, explicit open follow-ups, low recorded sentiment and low recorded QA. It provides handling steps without auto-closing a case, changing ownership, changing a callback, creating a commitment or modifying a supervisor request.

The continuity engine also corrects three data-quality problems:

- One historical interaction is now shown as previous contact, not automatically as a returning/repeat customer.
- Generic statuses such as `Recorded` no longer count as open follow-ups. Explicit open, active, in-progress, pending, awaiting, reopened, escalated, callback and follow-up statuses remain open unless a closed/resolved status takes precedence.
- Missing QA or sentiment remains `null` (unknown), not numeric zero.

Existing v6.68 continuity saves are normalised in place. Their interaction history is retained; no data deletion or schema migration is required.

## Before pushing

Confirm that your current `js/customer-continuity-engine.js` is the v6.68 continuity engine and that `js/main.js` still contains the `renderCustomerContinuityPanel` function and the following `ensureInboundQueue` function. The Vite transform fails explicitly rather than making a partial source edit if the expected continuity panel anchors have changed.

The public repository currently reports package version `0.3.0`; its `index.html` separately carries the visible `BUILD 1.4.0` label. Those values coexist in the inspected public `main` source. Do not treat that label difference alone as proof of a different source branch.

## GUI workflow

1. Back up the current GitHub `main` branch or create a restore point.
2. In GitHub Desktop, choose **Repository → Show in Explorer**.
3. Copy the two supplied source files into the exact paths above, allowing the engine file to replace the existing one.
4. Edit `vite.config.js` using the two additions in `VITE-CONFIG-ADDITIONS-v6.93.txt`.
5. Copy the two test files into the repository's `tests` folder.
6. Review the GitHub Desktop Changes tab. It should show the continuity engine replacement, new plugin, new tests and Vite config change. It should not show deleted public assets or environment files.
7. Commit as `CALLORIA v6.93 — Customer 360 recovery intelligence` and push to `main`.
8. Check the Vercel deployment log for successful `vite build` completion.

If the Vercel build rejects a source anchor, do not remove the guard or force the transform. Re-check that the current branch contains the v6.68 continuity engine and the matching Customer 360 panel baseline.
