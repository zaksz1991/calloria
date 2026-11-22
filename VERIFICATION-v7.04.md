# CALLORIA v7.04 verification

## Automated checks performed in the overlay workspace

| Check | Result |
|---|---:|
| Node regression tests | 32 passed, 0 failed |
| Build-manifest and Vercel-contract tests | Passed |
| npm strict lifecycle-script policy tests | Passed |
| Third-person v2.6 runtime-preservation tests | Passed |
| Current and v6.84-transformed world-shape tests | Passed |
| Source-drift warning/no-fatal-error tests | Passed |
| Transformed player-world JavaScript syntax | Passed |
| Package manifest JSON parse | Passed |
| GitHub Actions YAML syntax | Passed |
| ZIP integrity | Passed (`unzip -t`) |

## Production verification status

| Check | Status |
|---|---|
| Full Vite build against complete repository | Not run |
| GitHub Actions run on user's `main` branch | Not run |
| Vercel production deployment | Not verified |
| Desktop browser appearance | Not tested |
| Physical phone testing | Not tested |

## Interpretation

The 32 passing tests cover the isolated package/preflight checks, artifact-audit tests, npm policy, and current third-person plugin transform fixtures. The tests confirm that the avatar plugin preserves its existing post-transform camera/workstation behaviour and skips safely when required anchors drift. They do not prove that every Vite plugin in the full repository compiles together.

The new GitHub Actions workflow is intended to run the complete install, test, preflight, Vite build and artifact audit against the real repository after the overlay is pushed. A green CI run and a successful Vercel production deployment are still required before calling the production build recovered.
