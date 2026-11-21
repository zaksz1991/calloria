# CALLORIA v6.96 verification

## Local checks

| Check | Result |
|---|---:|
| Focused regression tests | 15 passed |
| Failed tests | 0 |
| Workload aggregation / sorting | Passed |
| Missing-owner and claim-state exception checks | Passed |
| HTML escaping checks | Passed |
| Main.js transform idempotency | Passed |
| Source-anchor fail-closed checks | Passed |
| Transformed fixture syntax | Passed |
| ZIP integrity | Passed |

## Coverage

- Empty, malformed and completed records are excluded safely.
- Owner grouping is case-insensitive and does not mutate source case records.
- Urgent, overdue, due-soon, in-progress and supervisor-review counts are independent and accurate.
- Missing owner, in-progress without claimant, and open with stale claimant are reported.
- Next due deadline uses the earliest simulated day/minute for each owner.
- Higher-risk owners appear first in the table.
- Owner, claimant and case-reference strings are escaped before HTML insertion.
- Transform inserts the engine import, CSS import, workload calculation and CRM panel exactly once.
- Source drift in any required main.js anchor fails closed.

## Not verified

- Full `npm run build` against the complete local repository.
- Live Vercel deployment.
- Runtime display in an actual browser or physical phone.
- Any production CRM or real customer system; all records are the synthetic local CALLORIA game records.

The tests use a focused source fixture built from the verified `c8a48d6` anchor lines. They are not a substitute for building the complete repository.
