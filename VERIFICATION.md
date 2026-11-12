# CALLORIA v6.7 Verification

## Automated checks

| Check | Result |
|---|---:|
| v6.7 engine + integration tests | 35 passed |
| v6.6 digital-channel tests | 19 passed |
| v6.5 voice regression tests | 29 passed |
| **Combined focused/regression tests** | **83 passed, 0 failed** |
| JavaScript syntax checks | Passed |
| HTML duplicate-ID check | Passed |
| Static controller selector check | Passed |
| ZIP integrity | Passed |
| Local static asset HTTP checks | Passed |

The combined `node --test tests/*.test.cjs` run completed with 83 tests passing and zero failures.

## Not performed

- Full CALLORIA repository test suite.
- Vite production build against the complete repository.
- Vercel deployment or verification at the live URL.
- Full browser end-to-end gameplay using the user's actual customer queue and all existing engine assets.

## Known boundaries

- Social, SMS and In-app contacts are still synthetic scenarios.
- No external social provider, SMS gateway or app messaging API is connected.
- Drafts and completed channel records remain in browser local storage.
- Social privacy detection is pattern-based; operators still need to avoid publishing personal information.
- SMS segment counts are estimates and not carrier billing calculations; Unicode limits are measured in UTF-16 code units.
