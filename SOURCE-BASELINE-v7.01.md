# CALLORIA v7.01 source baseline

Prepared against the publicly readable `main` branch inspected on 22 November 2026 and the Vercel failure supplied for commit `a0623b3`.

Observed source facts:

- The current public `package.json` declares the package name `calloria-v6.99-operations-capacity-outlook`, `private: true`, `type: module`, and a `test` script only. It does not declare `build`, Vite, Three.js or Supabase dependencies.
- The current `vite.config.js` imports the existing Vite plugin chain from local `build/` modules, declares a multi-page Rollup input list, and configures Three.js as a manual chunk.
- The repository `.nvmrc` selects Node `22.16.0`.
- The Vercel log supplied for commit `a0623b3` shows npm removing 23 packages, auditing only one package and then failing because `npm run build` does not exist.

v7.01 replaces only the root package manifest and `.nvmrc`, and adds a preflight utility plus isolated tests. It does not replace the current Vite configuration or application source. The source imports and configured build entries are checked by the preflight at install/build time; this archive's fixture tests validate the checker itself, not the full repository build.
