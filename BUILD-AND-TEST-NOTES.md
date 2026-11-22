# Build and test notes

Focused local command used during package validation:

`node --test tests/after-contact-evidence-v711.test.mjs`

Result: 15 tests passed, 0 failed.

The package contains no third-party dependency. Register the plugin once in `vite.config.js`; the application module is imported relatively from `js/main.js`.

A complete CALLORIA source checkout, its lockfile, Vite config and public GLB assets were not available in this artifact workspace. No full Vite build or deployment is claimed.
