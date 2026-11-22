# Build and test notes — v7.12

- This overlay adds no npm dependencies and makes no package manifest changes.
- The engine is ordinary browser-compatible ES module code.
- The Vite plugin is a post-transform and checks four exact Promise Control anchors before editing `js/main.js`.
- If any anchor count differs from one, the plugin emits a warning and leaves the source unchanged.
- A marker prevents duplicate transformation.
- The CSS is bundled through the import injected into `js/main.js`.
- Run the new test with the existing Node test runner: `node --test tests/callback-integrity-v712.test.mjs`.
- Run the project's normal test and production build after installing it. No command-line instructions are required for the installation itself; GitHub Desktop is sufficient to merge and push the files.
