# CALLORIA v6.13.2 — Supabase SDK Dependency Repair

## Build error addressed

The Vercel build now reaches Vite, but Rollup stops at:

`Failed to resolve import "@supabase/supabase-js" from "js/customer-care-workbench.js"`

The v6.13.1 package manifest restored the build script but omitted the Supabase SDK dependency. Consequently, `npm install` removed packages not declared by the replacement manifest, and Vite could not resolve the application import.

## Patch contents

This package contains a corrected repository-root `package.json` that preserves the CALLORIA 0.3.0 manifest profile and adds the stable Supabase JS v2 SDK at an exact version pin (`2.119.0`). The SDK remains a normal runtime dependency so Vite can bundle the browser module; it is not externalized.

## Installation

Replace the repository-root `package.json` with the supplied file.

Do not replace `vite.config.js`, application source, the GLB plugins, or the model directory. Do not delete `package-lock.json`. The Vercel install step uses `npm install`, which will reconcile the lockfile with the added dependency during installation. If your repository has additional dependencies not listed in this manifest, keep those existing entries when merging.

## What this does not claim

This corrects the specific missing-package error shown in the Vercel log. It does not prove the next build will pass; the next run may expose further missing dependencies or source errors. No app source, Supabase project settings, keys, database, migrations, or authentication behaviour are changed.
