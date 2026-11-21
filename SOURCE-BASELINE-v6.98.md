# CALLORIA v6.98 Source Baseline

Audit date: 21 November 2026.

Inspected public source:

- `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/qa-workspace-engine.js`

## Existing implementation verified

- `js/main.js` imports `DEFAULT_QA_SCORECARD`, `createHumanQAReview`, `createQADispute`, `resolveQADispute`, `createCalibrationSession` and `humanQAMetrics` from `qa-workspace-engine.js`.
- `renderQAWorkspace()` creates `reviews`, `disputes`, `calibrations` and `metrics` variables.
- The workspace already supports evidence-backed human QA reviews, scorecard versioning, agent disputes, independent dispute resolution and calibration sessions.
- Existing calibration records contain `scoreSpread`, `criterionComparisons`, `requiresDiscussion`, `reviewers` and `interactionId`.
- The QA workspace contains a Human QA review register followed by a two-column dispute/calibration area. v6.98 inserts its panel between those two sections.
- Public `vite.config.js` currently registers existing app plugins and ends its plugin list with the visitor-facing experience plugins. v6.98 is intended to be appended after those entries.

## Scope boundary

This is an additive Vite transform and two runtime assets. It does not provide a full repository checkout. The test fixture isolates the QA workspace anchors copied from the inspected public source; it is not a full `main.js` substitute. The complete Vite build and live browser behavior were not run in this environment. Verify the target branch's Vite and `main.js` versions before deployment.
