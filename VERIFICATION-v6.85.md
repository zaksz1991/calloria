# CALLORIA v6.85 verification

| Check | Result |
|---|---:|
| Current local-world anchor compatibility | PASS |
| v6.84-transformed-world anchor compatibility | PASS |
| Old combined GLB-ready callback dependency removed | PASS |
| Asynchronous avatar startup after first render | PASS |
| Touch devices retain first-person and skip avatar download | PASS |
| Both disposal variants release avatar/listeners and cancel pending startup | PASS |
| Idempotent transform / duplicate-listener prevention | PASS |
| Missing update anchor fails safely without partial output | PASS |
| JavaScript syntax check: current-world transformed fixture | PASS |
| JavaScript syntax check: v6.84 transformed fixture | PASS |

**Focused test result:** 7 passed, 0 failed.

**Limitations:** The full CALLORIA repository and package installation were not available for a complete Vite build. Vercel has not yet been redeployed with this replacement. No real phone or desktop browser runtime test was performed.
