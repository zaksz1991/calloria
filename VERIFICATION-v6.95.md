# CALLORIA v6.95 verification

## Local checks

| Check | Result |
|---|---:|
| v6.94 + v6.95 regression tests | 17 passed |
| Failed tests | 0 |
| New pending-customer timing tests | Passed |
| Customer-confirmation mutation guard tests | Passed |
| Plugin target filtering | Passed |
| Transform idempotency | Passed |
| Source-anchor fail-closed test | Passed |
| JavaScript syntax checks | Passed |
| ZIP integrity | Passed |

## Coverage

- Early-shift pending-customer deadline.
- Late-shift pending-customer deadline, including 23:00 simulation time.
- Consistency across the returned due object, follow-up fields and audit history.
- Agent resolution without customer confirmation does not mutate attempt/outcome fields.
- Supervisor closure guard inherited from v6.94.
- Escalation behaviour remains available.
- Plugin transforms only `js/case-lifecycle-engine.js`.
- Transform is repeat-safe and rejects source-anchor drift without emitting a partial transform.

## Not verified

- Full `npm run build` against the user's complete working tree.
- Current Vercel deployment.
- Runtime display in a live CALLORIA session.
- Any external CRM, customer database or real customer information; this simulation uses local synthetic case records.
