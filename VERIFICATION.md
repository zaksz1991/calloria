# Verification — CALLORIA v6.31

- Node regression suite: 58/58 tests passed.
- Plugin JavaScript syntax: passed (`node --check`).
- Transformed staff runtime JavaScript syntax: passed (`node --check` on output generated from the v1.2 fixture).
- Transform idempotence: covered by regression tests.
- Unknown runtime source: fails closed in regression tests.
- Authored GLB animation path: preserved in regression tests.
- ZIP integrity: checked after packaging.

Not verified: full Vite build against the current repository, Vercel deployment, live browser rendering, or whether every production GLB uses the recognised head/neck bone names. Actual scene output must be confirmed in the deployed game.
