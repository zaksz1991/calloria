# Build and test notes — v7.19

- Focused test command used during package verification: `node --test tests/digital-disposition-integrity-v719.test.mjs`.
- Result: 13 tests passed, 0 failed.
- Syntax checks: helper module, Vite plugin and test module passed `node --check`. A transformed `main.js` fixture also passed `node --check`.
- The full repository build was not run because the complete current repository checkout is not available in this workspace.
- Vite plugin uses a strict all-or-nothing anchor check. If source anchors do not match exactly once, it warns and skips without partially rewriting `main.js`.
