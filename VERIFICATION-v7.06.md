# CALLORIA v7.06 verification

## Locally verified

- The exact v7.05 navigation audit was run against a merged v7.05 + v7.06 workspace containing a `support-router.html` link to `/privacy.html` and the supplied `public/privacy.html`; the audit passed with zero broken references.
- The full existing v7.05 `.mjs` test suite plus the four new v7.06 regression tests ran in that merged test workspace: **44 passed, 0 failed**.
- The new tests verify the reported `/privacy.html` resolution, Vite `publicDir`/`dist` configuration, privacy page return routes and separation of AI/formal-support data flows.
- The test file parsed and executed under Node.js 22.16.0.
- The package only adds a public HTML page and one regression test. It does not replace build configuration, application JavaScript or data services.

## Not verified

- The full repository `npm test` command was not run against the live GitHub checkout.
- The full Vite production build was not run.
- GitHub Actions and Vercel deployment were not run.
- Production Groq Zero Data Retention settings and exact server-side retention schedules were not independently inspected. The privacy notice explicitly avoids claiming that Zero Data Retention is enabled or publishing unsupported retention periods.

The v7.06 overlay addresses the single `/privacy.html` error in the supplied Vercel log. A subsequent build may reveal additional unrelated route or compilation problems.
