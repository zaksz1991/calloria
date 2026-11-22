# CALLORIA v7.15 — Digital Response Quality Coach

An additive overlay for the current public CALLORIA `main` source.

## What it adds

- A live response-quality coach to the active email, live-chat and social thread.
- Five deterministic coaching checks: acknowledgement, ownership, next step, privacy and factual restraint.
- Hard stops for credential requests, unmasked payment-card numbers and public social requests for personal/account identifiers.
- Advisory warnings for weak acknowledgement, unclear ownership, missing next step and unsupported guarantees.
- A capture-phase submit guard that blocks only identified safety issues; ordinary coaching gaps do not prevent sending.
- Responsive, low-motion-aware styling.

The coach is a simulation aid. It does not replace human QA, write to Supabase, save a new score, or alter the native digital QA engine.

## Package contents

- `build/calloria-digital-response-quality-coach-v715.mjs`
- `js/digital-response-quality-coach-v715.js`
- `styles/calloria-digital-response-quality-v715.css`
- `tests/digital-response-quality-v715.test.mjs`
- Installation, source-baseline, changelog and verification notes.

## Install

Merge the included folders into the repository and register the plugin once in `vite.config.js`. See `INSTALL-GITHUB-v7.15.md` and `VITE-CONFIG-ADDITIONS-v7.15.txt`.

This is not a complete repository replacement. Preserve all existing project files and settings.
