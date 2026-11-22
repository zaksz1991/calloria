# CALLORIA v8.0 — Full Integration and Production Stabilisation

**Product:** CALLORIA — Every Call. Every Customer. Every Career.  
**Repository:** `zaksz1991/calloria`  
**Production site:** `https://calloria.vercel.app`  
**Baseline:** Current public `main` containing the v7.23–v7.31 digital/workforce feature chain.

## What v8.0 changes

CALLORIA v8.0 consolidates the v7.22–v7.31 digital-support and workforce feature chain into one ordered Vite registration group. The individual feature modules remain separate and testable; their order is now declared in one place.

A production integration gate now stops configuration/build when:

- a required v7.22–v7.31 plugin is missing, duplicated or out of order;
- one of the 20 existing HTML pages is missing from Vite's multi-page input map or the source tree;
- the public chat-widget entry is missing;
- the production bundle omits a configured HTML page or the chat-widget output.

The new source-level release audit also checks the package scripts, Node 22 pin, pinned dependencies, Vercel output contract and local Vite import graph before Vite starts.

## Preserved

- Existing 3D, workplace, OJT, recruitment, voice and multichannel plugins.
- The customer-care, CRM, voice, email, live-chat, social, SMS, workforce and asset-inspector pages.
- Existing Supabase project, database, Edge Functions, secrets and authentication settings.
- Existing GLB models, public assets, guest progress and customer/employee data.
- Existing dependency versions: Vite 6.4.5, Three.js 0.170.0, Supabase JS 2.119.0 and esbuild 0.25.12.

No database migration, new dependency, secret, environment variable, provider account or external integration is introduced.

## Verification boundary

The supplied v7.23–v7.31 and v8.0 focused regression suites pass **127/127 tests**. JavaScript syntax checks pass for **43/43 files** in this release workspace. A full production Vite build, full repository test suite, deployed browser session, real mobile-device test and Vercel deployment were not run from this workspace. The deployment must report a successful Vercel build before v8.0 is considered production-stable.

This ZIP is a cumulative feature-chain and integration overlay, not a copy of the entire application repository. Merge it into the existing repository; do not replace the repository with this folder.
