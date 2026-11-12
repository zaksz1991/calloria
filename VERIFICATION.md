# Verification — v6.13.2

- `package.json` parses as valid JSON.
- Required scripts `dev`, `build`, `preview`, `check`, and `test` are present.
- `build` resolves to `vite build`.
- `@supabase/supabase-js` is declared under runtime `dependencies` at exact version `2.119.0`.
- Three.js remains pinned to `0.170.0`; Vite remains pinned to `6.4.5`.
- Node engine remains `>=22.12.0`.
- The patch intentionally does not replace the project lockfile.

A complete Vite build was not run because this workspace does not contain the current CALLORIA repository source tree, its exact `vite.config.js`, or current `package-lock.json`.
