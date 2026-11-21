# CALLORIA v6.98 — QA Consistency & Coaching Intelligence

## Added

- Read-only QA intelligence panel in the existing Human QA workspace.
- Criterion-level aggregation across human QA reviews, partitioned by scorecard ID.
- Low-rating frequency and average rating for each criterion.
- A minimum evidence threshold: fewer than three observations are labelled `EARLY SIGNAL`, never a repeated pattern.
- Priority coaching signals when at least three observations exist and the mean rating is 3/5 or lower, or at least half of ratings are 3/5 or lower.
- Watch signals for a mean rating of 3.5/5 or lower, or a low-rating frequency of at least 35%.
- Calibration exceptions for total-score spreads of 10 points or more, explicit `requiresDiscussion` sessions, or criterion rating spreads of 2 or more.
- Separate open, upheld and adjusted QA dispute counts.
- Responsive layout for desktop, tablet and narrow phone screens.

## Integrity and safety

- Read-only: no writes to `state`, local storage, Supabase, employee records or QA records.
- Does not recalculate, adjust or override a human QA result.
- Does not make hiring, disciplinary, salary or promotion decisions.
- Uses the existing Human QA review, calibration and dispute records only.
- Partitions criterion observations by scorecard ID to avoid combining differently configured scorecards.
- Ignores malformed ratings and duplicate review/criterion entries.
- Escapes dynamic labels before HTML rendering.
- The Vite transform pre-validates all source anchors and skips safely with a warning if the source has drifted.
- No new dependency, database migration, API endpoint, environment variable or external network call.

## Installation

Register `calloriaQAQualityIntelligencePluginV698()` once as the final plugin in the existing Vite plugin array. See `INSTALL-GITHUB-v6.98.md`.
