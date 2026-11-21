# Verification — CALLORIA v6.97

## Automated tests

**33 passed · 0 failed** using Node.js 22.16.0 and `node --test tests/*.test.mjs`.

Coverage includes:

- v6.96 regression suite for owner grouping, active follow-up counting, ownership exceptions, escaping and Vite source transformation.
- Ranking supervisor reviews, overdue work and approaching deadlines.
- Exact simulated-deadline boundaries at 0, 15, 60 and 61 minutes.
- Separate off-shift and clock-unavailable states.
- Missing owner, missing claimant and stale-claim next actions.
- Non-mutation of supplied CRM rows.
- Bounded action list and additional-item count.
- Escaping of customer, case reference, title, owner and claimant strings.
- Correct v6.96 then v6.97 plugin composition and idempotency.
- Fail-closed behaviour when the v6.96 transform or one required anchor is missing.
- Combined transformed fixture passing `node --check`.

## Static checks

- New planner engine syntax: passed.
- New Vite plugin syntax: passed.
- Included v6.96 dependency syntax: passed.
- New CSS brace balance: passed.
- ZIP archive integrity: passed.

## Not verified

- Full repository `npm test`.
- Full Vite production build.
- Vercel deployment or browser runtime.
- Physical mobile-device testing.
- Integration with a branch that no longer matches the v6.96 CRM transform anchors.

The package is a source overlay. The user's full repository checkout was not available in this session, so this report does not claim a complete application build or live deployment.
