# CALLORIA v7.05 verification

## Preparation checks

| Check | Result |
|---|---|
| Cumulative focused regression suite | 40 passed, 0 failed |
| Navigation audit JavaScript syntax | Passed |
| Updated build preflight syntax | Passed |
| Package JSON validation | Passed |
| Prebuild/check script linkage | Passed |
| ZIP integrity | Passed after archive creation |
| Full repository test suite | Not run against a complete checkout |
| Full Vite production build | Not run |
| Browser / mobile acceptance | Not performed |
| GitHub Actions / Vercel production deployment | Not verified |

The tests use temporary, synthetic project fixtures. They verify the audit's behaviour, not the full live repository's route status.

## Integration

`npm run check` and the `prebuild` lifecycle now run the navigation audit after the existing manifest preflight. `npm run build` therefore stops before Vite if a configured page references a missing local path or if a home navigation view is not represented in `js/main.js` render metadata and switch cases.

## Important baseline limitation

The public GitHub `main` branch checked during preparation still exposes the v7.01 README and a test-only `package.json`; the v7.04 production repair has not yet appeared in that public baseline. v7.05 therefore packages the v7.04 build files cumulatively. Use this release as one combined installation rather than applying v7.04 and v7.05 separately. A successful result still requires pushing the files and observing GitHub Actions and Vercel.
