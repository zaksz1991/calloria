# CALLORIA v6.98 Verification Report

## Automated checks completed

| Check | Result |
|---|---:|
| Focused Node regression tests | 14 passed |
| Failed regression tests | 0 |
| Runtime module syntax (`node --check`) | Passed |
| Vite plugin syntax (`node --check`) | Passed |
| Transformed QA fixture syntax (`node --check`) | Passed |
| Source-transform idempotency | Passed |
| Source-anchor mismatch safety | Passed |
| HTML text escaping cases | Passed |
| Input immutability checks | Passed |
| ZIP integrity | Pending archive creation |

## Test coverage

- Criterion average and low-rating aggregation.
- Three-observation threshold for repeat signals.
- Scorecard partitioning.
- Duplicate review and criterion protection.
- Calibration score and criterion spread flags.
- Open/upheld/adjusted dispute counts.
- Malformed input handling.
- Early-sample advisory wording.
- Escaping of dynamic labels.
- No mutation of review/calibration source records.
- Vite transform registration, insertion locations and stylesheet import.
- Transform idempotency and non-fatal behavior when source anchors drift.
- Non-target module exclusion.

## Not verified

- Full repository `npm run build` / Vite production build.
- Deployment on Vercel.
- Runtime operation in a live browser or on a physical phone.
- Integration with private or uncommitted changes in the user's current checkout.

The tests use a focused fixture containing the inspected QA workspace anchors. This is not a full `main.js` checkout. The plugin warns and skips without partial changes if those anchors have changed.
