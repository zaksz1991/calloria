# CALLORIA v8.12.1 — Integrated Recovery Build Gate

Target repository: `zaksz1991/calloria`  
Branch: `main`  
Production site: `https://calloria.vercel.app`

## Purpose

This overlay closes the integration gaps found when the v8.9–v8.12 recovery features were assembled together. It does not add another end-user dashboard or alter career/gameplay systems.

## What is verified

The cumulative audit checks the v8.9–v8.12 engines, tests, package scripts, stable shared Vite plugin identity, the existing Node 22 and dependency pins, and the exact protected `prebuild`/`check` hooks. It then runs all 49 cumulative recovery regression tests and the dedicated v8.9 audit.

The shared Vite plugin calls this audit during `buildStart` only for production builds. Thus the Vercel build cannot progress to the generated bundle while these recovery integration checks fail, and local `vite dev` does not rerun the suite on startup.

## Prerequisite

The existing repository must already contain all v8.9, v8.10, v8.11 and v8.12 feature files and tests. This is an updated-files overlay, not a full repository replacement. If an earlier release was not merged, the integration gate reports the missing path rather than fabricating it.

## Verification boundary

The 49 regression tests and the integration/audit checks passed against the assembled v8.9–v8.12 overlay chain. The full CALLORIA source repository, actual Vercel build, final `dist` artifact audit, live Supabase checks and physical mobile/browser acceptance were not available in this run. Those remain production acceptance checks.
