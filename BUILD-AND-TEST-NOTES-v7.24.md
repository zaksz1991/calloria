# CALLORIA v7.24 — Build and test notes

The package includes the current v7.22 digital integration modules and tests, the v7.23 Customer Recovery Plan files, and the new v7.24 composition plugin.

The test run used Node's built-in test runner in an isolated package workspace:

`node --test tests/*.test.mjs`

Result: **128 passed, 0 failed**.

Syntax checks used Node's parser on every included `.js` and `.mjs` file plus `vite.config.js`; all passed.

A production Vite build was not run. The package workspace does not contain the full application repository, its other imported Vite plugins, all multi-page HTML entries, or the production public asset/GLB tree. Do not interpret unit-test success as a verified production build.
