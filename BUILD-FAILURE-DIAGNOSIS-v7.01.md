# Build failure diagnosis and v7.01 response

## Failure recorded in the Vercel log

At commit `a0623b3`, npm reported `removed 23 packages`, audited one package and then failed with `Missing script: "build"`. The public `package.json` at that revision contained only a test script and no declared application dependencies. That is a manifest failure, not a Three.js, Supabase, Vite-transform or application-runtime failure.

## v7.01 correction

The root manifest is restored with the Vite lifecycle scripts and the three direct packages required by the current source. `engines.node` is changed to `22.x`. Vercel documents that only Node major versions are selectable and that an open-ended range such as `>=20.0.0` can move to a newly supported major; Node `22.x` keeps CALLORIA on the existing Node 22 compatibility line. The repo's `.nvmrc` is aligned to major 22.

The preflight script uses Node built-ins only. It can run during npm `preinstall` before dependencies are installed, then repeats before `vite build`. It validates direct dependency declarations, all relative imports found in `vite.config.js`, and all `resolve(process.cwd(), ...)` build entries. Build mode also checks that Vite, Three.js and Supabase packages are present in `node_modules`.

## Verification boundary

The package JSON was parsed, the guard script syntax-checked, and six isolated fixture tests were run successfully. A full repository `npm install`, full Vite build and Vercel deployment were not run in this environment. The guard's tests do not represent a successful production build.
