# CALLORIA v2.4 — Third-person GLB Player Character

This package adds a visible player character using the existing CALLORIA agent GLBs and follows the existing movement controller with a third-person camera. No new WebGL renderer, application state system or animation loop is created.

See `INSTALL.md` before merging the files. The package includes a complete `vite.config.js` replacement based on the current public `main` branch configuration; it adds only the new post-transform plugin registration and preserves the existing multi-page build entries and plugins.
