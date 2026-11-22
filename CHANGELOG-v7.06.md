# CALLORIA v7.06 — Privacy Route Repair

## Build failure addressed

Vercel commit `312a171` reached the v7.05 prebuild navigation audit, then stopped because `support-router.html` linked to `/privacy.html` but no deployable file existed at that URL.

## Changes

- Adds `public/privacy.html`, which Vite copies to `dist/privacy.html` through the existing `publicDir: 'public'` configuration.
- The page provides a responsive privacy notice describing guest/browser data, optional account and workforce features, Groq-powered AI Customer Care, formal support routing, Supabase, retention limits and user choices.
- Adds regression tests for the exact broken route, the public-file placement and the privacy content requirements.
- No Vite entry, Vercel setting, environment variable, database migration, application JavaScript or existing asset is changed.

## Scope

This is an additive overlay for the v7.05 branch shown in build commit `312a171`. It addresses the one navigation-audit error reported in the supplied log. It does not establish that no further errors will appear after this one is fixed, and it does not prove a full Vite build or deployment.

## Verification summary

The existing v7.05 Node regression suite and the four new v7.06 tests passed together in a merged test workspace: 44 tests passed, zero failed. A full Vite build and live Vercel deployment remain unverified.
