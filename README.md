# CALLORIA v2.6 — Production Regression Gate

This package adds one GitHub Actions workflow. It does not modify application source, gameplay, Supabase, Vite configuration, dependencies, or GLB assets.

## What it checks on every push to `main` and every pull request

1. Installs the repository's current npm dependencies.
2. Runs the existing `npm run check` syntax checks.
3. Runs the full `npm test` suite.
4. Runs the actual Vite production build.
5. Verifies that `dist/` contains the inspector, the primary agent GLBs, office GLBs, and at least 16 source GLB files.

The workflow uses Node.js 24, which satisfies the repository's declared Node.js engine range (`>=22.12.0`). It uses the current major versions of the official checkout and setup-node actions.

## Install

Merge the `.github` folder into the repository root. The only file added is:

```text
.github/workflows/calloria-production-gate.yml
```

No existing file should be replaced.

## Expected behaviour

After the commit reaches GitHub, open **Actions → CALLORIA production regression gate**. It runs automatically. A green result means the repository's tests passed, Vite built the production output, and the required GLB/inspector files were copied into `dist/`.

A green GitHub check does not, by itself, prevent Vercel from starting a deployment at the same time. To make it a hard merge gate, configure the repository's `main` branch protection to require the `Tests, Vite build and GLB delivery` check.

## Scope and limitations

This is a build and regression gate, not a new game feature. It does not prove that a GLB renders correctly on a physical phone or that the full game has acceptable frame rate. Those still require browser/device testing.
