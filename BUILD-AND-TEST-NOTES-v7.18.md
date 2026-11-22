# Build and test notes — v7.18

- Runtime used for focused checks: Node.js 22.16.0.
- Focused suite: `node --test tests/digital-sla-triage-v718.test.mjs` — 14 passed, 0 failed.
- Syntax: new `.js`, `.mjs` and test source checked with `node --check`.
- Transform test: source fixture transformed and the result passed `node --check`.
- Full project install/build not run. Do not interpret these focused checks as a successful Vite or Vercel build.
