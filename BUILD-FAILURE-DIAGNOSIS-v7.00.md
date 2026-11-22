# Build diagnosis — CALLORIA v7.00

## Root cause established from the deployment commit

The Vercel deployment cloned `a0623b3`. The root `package.json` at that commit is a reduced manifest containing only:

- `name: calloria-v6.99-operations-capacity-outlook`
- `private: true`
- `type: module`
- `scripts.test`

It has no `scripts.build`, no `vite` dependency, and no `@supabase/supabase-js` or `three` dependencies.

That directly explains the log:

- `removed 23 packages` — npm reconciled the existing cached install against the reduced manifest and removed packages no longer declared.
- `audited 1 package` — only the root package remained in the dependency graph.
- `npm error Missing script: "build"` — Vercel correctly ran the configured `npm run build`, but the script was absent.

This is not a Vercel outage, a Node engine failure, or a Vite compilation error. Vite never started.

## Restored manifest

The replacement restores the canonical CALLORIA manifest currently present on public `main`:

- `dev`: `vite --host 0.0.0.0`
- `build`: `vite build`
- `preview`: `vite preview --host 0.0.0.0`
- existing source `check` command
- existing test command
- runtime dependencies: `@supabase/supabase-js@2.119.0`, `three@0.170.0`
- development dependency: `vite@6.4.5`
- Node engine requirement: `>=22.12.0`

## Not implicated by this failure

The `npm warn Unknown env config "cache-dir"` line is a warning, not the cause. Vercel's `npm run build` is also not the problem: the repository's correct build command is `vite build`.

## Verification boundary

The replacement manifest was parsed as JSON and checked for the expected script/dependency declarations. ZIP integrity was checked. A full Vite build was not run because the complete project checkout and its application dependencies are not mounted in this repair workspace. Vercel deployment success remains pending the next push.
