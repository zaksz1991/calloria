# Verification — CALLORIA v7.21

## Automated regression tests

| Test area | Result |
|---|---:|
| First-response exclusion | Passed |
| Follow-up on-track state | Passed |
| 75% risk threshold | Passed |
| Overdue state | Passed |
| Follow-up response met | Passed |
| Follow-up response late | Passed |
| Consecutive customer-message grouping | Passed |
| Multiple response cycles | Passed |
| Per-contact SLA override | Passed |
| Invalid timestamp handling | Passed |
| Queue and channel aggregation | Passed |
| Corrupt timestamp ordering | Passed |
| Channel inheritance | Passed |
| Read-only assessment / no mutation | Passed |
| Invalid input handling | Passed |
| Vite transform injection | Passed |
| Safe source-drift skip | Passed |
| Main-file-only transform | Passed |
| Transform idempotency | Passed |
| Transformed fixture syntax | Passed |

**Total: 20 passed, 0 failed.**

## Additional checks

- `node --check` passed for the response-cycle engine.
- `node --check` passed for the Vite plugin.
- The transformed `main.js` fixture passed Node syntax checking.
- The zip archive passed `unzip -t` integrity validation.

## Not performed

- Full `npm install` or full repository `npm run build` was not run because this package does not contain the complete CALLORIA checkout.
- Vercel deployment was not run.
- Physical mobile-device testing was not performed.
- The feature has not been tested against a private or locally modified working tree; the plugin safely skips if its four source anchors have drifted.
