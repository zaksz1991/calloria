# CALLORIA v6.90 — Verification report

## Automated checks performed in the preparation environment

| Check | Result |
|---|---:|
| v6.90 focused tests | 11 passed, 0 failed |
| v6.89 shift-review tests | 7 passed, 0 failed |
| v6.90 ESM syntax check | Passed |
| v6.89 ESM syntax check | Passed |
| HTML parse check | Passed |
| HTML stylesheet/module references | Passed |
| Module order (`v6.89` → `v6.90` → `main.js`) | Passed |
| CSS delimiter sanity check | Passed |
| ZIP integrity | Passed |

## v6.90 regression coverage

1. Hides command-centre priorities when the shift is inactive.
2. Ranks critical inbound queue work and displays queue wait age.
3. Applies digital SLA target/risk/breach logic to digital work.
4. Hides active digital contacts assigned to other employees.
5. Shows only scheduled callbacks whose due time has arrived.
6. Prioritises overdue reopened-case follow-ups using the simulation day and clock.
7. Surfaces open supervisor requests.
8. Places current calls and after-contact work ahead of new contacts.
9. Does not mutate the saved application state.
10. Produces accessible, escaped panel markup and uses existing navigation targets.

## Combined regression result

The v6.90 command-centre suite (11 tests) and the retained v6.89 shift-review suite (7 tests) were run together: **18 passed, 0 failed**.

## Not verified

- Full `npm run build` against the user's deployed checkout.
- Vercel deployment.
- Real browser interaction or mobile-device testing.
- The behaviour of the user's organization-scoped cloud save in production.

The release tests exercise the pure priority engine and generated panel markup. They do not substitute for a full browser session or production build.
