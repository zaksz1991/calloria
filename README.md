# CALLORIA v7.31 — Workforce Trend & Evidence History

A cumulative v7.23–v7.31 source overlay for the existing CALLORIA Supervisor workspace. It extends the v7.30 Workforce Intelligence Command Centre with manually captured aggregate snapshots, trend comparisons and local history export.

## What's new in v7.31

### Aggregate workforce snapshots

A supervisor can capture the current v7.30 command-centre board as a dated baseline. Snapshots contain aggregate operational counts and rates, available workstream values, and department groups that already have explicit mappings.

### Change comparisons

When a saved snapshot exists, the panel compares the current board with the most recent saved snapshot:

- completed digital replies;
- open digital work;
- overdue digital work;
- at-risk digital work;
- response-target rate;
- channel-specific completion, open, overdue and response-target changes;
- mapped-department completion, open, overdue, at-risk and response-target changes.

The trend direction is calculated according to the measure: an increase in completed replies or response-target rate is positive, while a decrease in open, overdue or at-risk work is positive. Missing comparison values are not scored. New channels and departments do not receive fabricated baseline values.

### Local history and export

- Up to 90 snapshots are retained in browser localStorage.
- Snapshots are ordered by capture timestamp; duplicate timestamps replace the matching snapshot.
- A CSV export includes aggregate summary, workstream and department rows.
- The supervisor can clear this browser's history after a confirmation step.

## Data privacy and operating limits

The snapshot schema excludes individual employee IDs, customer details, case references and transcripts. It does include aggregate department labels and counts where those department mappings exist. Browser-local history is not a cloud backup, not shared with the organisation, and not synchronised between devices or browsers. Capture is manual, not scheduled or automatic. Trend comparisons do not prove cause or constitute HR decisions.

## Package contents

- `js/workforce-trend-history-engine-v731.js`
- `build/calloria-workforce-trend-history-v731.mjs`
- `styles/calloria-workforce-trend-history-v731.css`
- `tests/workforce-trend-history-v731.test.mjs`
- `tests/vite-config-v731.test.mjs`
- Updated `vite.config.js`
- v7.23–v7.30 source overlays, tests and release documents carried forward from the provided v7.30 package.

This is not the complete CALLORIA repository. It does not contain the private `.git` metadata, all original application source, local environment files or the existing `public/assets/` GLB binaries. Preserve those from the actual repository checkout.

## Validation

- 121 automated tests passed; 0 failed.
- 38 JavaScript/MJS files passed Node syntax checks.
- Generated v7.23–v7.31 transform-chain syntax passed.
- A complete Vite production build, live deployment and physical mobile checks remain unverified.

See `docs/TEST-RESULTS-v7.31.txt` and `docs/RELEASE-STATUS-v7.31.txt`.

## Installation

Use `INSTALL-GITHUB-v7.31.md`. Merge the v7.31 files into the existing repository and register the plugin immediately after v7.30. Keep the `.git` directory, original application files, `public/assets/`, GLB models and existing environment configuration untouched.
