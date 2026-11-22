# Source Baseline — CALLORIA v7.14

Source review date: 22 November 2026.

Public repository reviewed: `https://github.com/zaksz1991/calloria`, branch `main`.

Files reviewed:
- `js/main.js`
- `js/campaign-operations-engine.js`
- `vite.config.js`
- `package.json`

Observed source behaviours:
- `callbackIsDue()` uses the commitment engine's simulated shift snapshot when a callback has a `commitmentId`, with a wall-clock fallback for legacy callback rows.
- `resumeOutboundCallback()` rewrites campaign work-item due times to one second before the real system clock after the simulated commitment check.
- `scheduleRetryForCommitment()` writes `Date.now() + 60_000` to the outbound work item even though `createCallbackRecordFromCommitment()` returns the commitment's real due time.
- New outbound callback wrap-up writes a temporary wall-clock due time to `finishCampaignContact()`, then copies that same temporary value into the work item.
- `campaignContactEligibility()` compares `callbackDueAt` against wall-clock `now`.
- `finishCampaignContact()` requires a callback timestamp strictly later than wall-clock `now`.
- A cancellation path can mark a linked outbound callback `completed` before the promise has a verified customer outcome.

The Vite configuration currently registers the existing world, mobile, workforce, career and public-hub transforms. The v7.14 plugin must be registered last, after the existing source transforms.

The full repository was not available in the local runtime. The tests therefore use source fixtures built from the exact current public-source anchors reviewed above. A full repository Vite build and Vercel deployment remain outstanding verification steps.
