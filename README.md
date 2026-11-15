# CALLORIA v6.58 — RuffNeck Try-It Studio

A cumulative integration package for the existing CALLORIA repository. v6.58 makes RuffNeck product discovery interactive before a visitor leaves CALLORIA for an official product destination.

## Visitor experience

The Customer Care discovery guide now includes a **Try before you choose** strip and a **Try a quick preview** action on each recommended product card. Visitors can explore all six previews or start with a goal they selected:

- RuffNeck Learn: define a learning outcome and check practical learning.
- RuffNeck Prospector: qualify a fictional business lead and record an agreed next step.
- RuffNeck Connect: welcome a new member and resolve a collaboration disagreement.
- RuffNeck Social Hub: choose a campaign objective and meaningful result measure.
- Kano Run / Kano Life: make safe decisions in fictional driving situations.
- Kano Keke: handle a passenger route and vehicle-capacity situation responsibly.

Each preview has two short decisions, explanations for the choices, a score, and links to the official destination or a prefilled access/pricing enquiry.

## Guest-first and privacy boundary

- No CALLORIA account, contact details, payment details, or live RuffNeck login is required for a preview.
- Completion counts and best scores are stored locally in the visitor's browser under `calloria.public.tryit.v1`.
- Preview results are not submitted to CALLORIA or a RuffNeck product.
- Each exercise is clearly labelled as a fictional educational sample, not a live product demonstration or a statement of actual product functionality.
- The access/pricing link opens the existing support router with a product and enquiry intent preselected. The visitor reviews the request and remains responsible for consent and submission.
- Official product navigation opens the relevant existing RuffNeck destination in a new tab.

The existing 3D game, guest play entry, workforce screens, CRM, and payment paths are not modified by this release.

## Package contents

- `build/`: cumulative v6.42–v6.57.1 integration plugins plus the new v6.58 plugin.
- `tests/`: cumulative integration tests and fixtures, plus nine v6.58 tests.
- `vite.config.js`: cumulative plugin registration through v6.58.
- `README.md`, `CHANGELOG.md`, `INSTALL-GITHUB.md`, `VERIFICATION.md`, and `TEST-RESULTS.txt`.

This is a cumulative build-integration package, not a complete export of every application source file, public asset, Supabase migration, or environment variable in the CALLORIA repository.
