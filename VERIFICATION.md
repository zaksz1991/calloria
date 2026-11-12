# v6.15 verification

Executed locally against the files in this package:

- Focused Node tests: **14 passed, 0 failed**.
- JavaScript syntax checks: passed for both runtime modules and the test file.
- Meshopt + Draco loader configuration checks: passed.
- DRACO decoder path normalization tests: passed.
- Load-error classification tests: passed.
- Existing office asset plan and v2.9/Vite transform-anchor regression checks: passed.
- ZIP integrity: passed.

Not executed:

- Full CALLORIA Vite production build.
- Vercel deployment.
- Actual HTTP fetch of office GLB assets or the Google DRACO CDN.
- Browser Three.js rendering or Android visual QA.

The real office GLB files were not available in this workspace, so this release does not claim the assets have loaded or rendered successfully.
