# CALLORIA v7.24 — Source baseline and findings

Reviewed current public `main` on 22 November 2026.

## Confirmed from public source

- `package.json` now contains `preinstall`, `prebuild`, `build: vite build`, `postbuild`, and the Node 22 engine declaration. The earlier missing-build-script failure is no longer present in the current public manifest.
- `vite.config.js` registers `calloriaDigitalExperienceSuitePluginV722()` as its final plugin, but does not import or register the v7.23 Customer Recovery Plan plugin.
- `js/customer-recovery-plan-engine-v723.js` is present on the public branch; the expected `build/calloria-customer-recovery-plan-v723.mjs` raw path returned 404 at audit time. This is why the recovery engine alone cannot activate a Customer 360 panel.
- `js/main.js` initializes new applicants with `selectedTrack: 'banking'`, `department: 'Banking Operations'` and `salary: 185000`, despite offering `service` / `Customer Experience` in the application modal.
- The Customer 360 render function contains the v7.23 insertion anchors: continuity engine import, `renderCustomerContinuityPanel`, context lookup and the Match basis footer.
- Existing state migration is `{ ...initialState(), ...parsed }`. v7.24 also backfills department and salary from the saved career track only when those two fields were absent in an older save; already populated values are never overwritten.

## v7.24 resolution

- Supplies the missing v7.23 build plugin alongside its engine, CSS and tests.
- Wraps the v7.23 transform in a single v7.24 composition plugin that executes after the existing v7.22 suite.
- Changes the fresh-state defaults for career track, department and starting salary. When loading an older record missing department or salary, fills those missing fields from the saved track without changing any populated saved value.
- Does not change existing saved records or the candidate modal's available career-track options.

## Boundaries

The local workspace did not contain the full current repository or the complete public GLB asset tree. The Vite configuration was reconstructed from the current public source snapshot that was also supplied in the v7.22 integration package. Therefore this package must be merged into the same public `main` baseline; do not use it against an unrelated older branch without reconciling `vite.config.js` first.
