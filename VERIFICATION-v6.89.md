# CALLORIA v6.89 — Verification

## Automated checks performed in the preparation environment

| Check | Result |
|---|---:|
| Shift review regression tests | 7 passed, 0 failed |
| ESM syntax check | Passed |
| HTML parse check | Passed |
| CSS delimiter sanity check | Passed |
| ZIP integrity | Passed |

## Regression coverage

1. Normalises missing or non-numeric state counters.
2. Calculates inbound/outbound/resolution/sales/case/commitment deltas.
3. Calculates QA and CSAT averages from the new count/total differences.
4. Prevents negative deltas when counters are reset or migrated.
5. Escapes dynamic content and marks post-reload summaries as partial.
6. Opens a report only on a saved active-to-closed shift transition.
7. Suppresses reports for ordinary saves and supports resumed active shifts.

## Not verified

- Full `npm run build` against the user's deployed checkout.
- Vercel deployment.
- Physical Android/iOS browser testing.
- Live gameplay with the user's guest or organization-scoped save.

The automated tests use a mock Storage and document implementation. They do not substitute for a production browser test.
