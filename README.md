# CALLORIA v8.2 — Unified Workforce Cloud-History Integration

## Purpose

v8.2 closes the integration gap between the v8.0.1 production gate and the v8.1 organisation workforce trend-history feature. It does not add another standalone dashboard or another independently registered Vite plugin.

## What changed

- Promotes the v8.1 organisation cloud-history plugin into the central `calloriaWorkforceDevelopmentSuitePluginsV8()` registration group.
- Establishes one deterministic 11-plugin sequence: v7.22 through v7.31, followed by v8.1 cloud trend synchronisation.
- Extends the production integration gate to require the cloud-history plugin exactly once and after v7.31.
- Removes the separate v8.1 Vite registration so the same transformer cannot be registered twice.
- Extends the V8 integration audit and install/build preflight to require the cloud plugin, engine, CSS, SQL migration and regression tests.
- Retains the v8.0.1 import lexer repair and the existing 20 HTML entries plus the embeddable chat widget.
- Preserves the v8.1 aggregate-only, explicit organisation sync workflow and its existing security model.

## Cloud-history behavior retained

- Browser-local history remains the default and remains available to guests.
- Cloud synchronisation is explicit; it does not upload automatically.
- Cloud operations require an authenticated user in an active CALLORIA organisation with `reports:read` permission.
- The database RPC reconstructs the snapshot from an allow-list. Employee identifiers, customer information, case references, transcripts and narrative notes are not persisted.
- Organisation history is limited to 90 aggregate snapshots.

## Package type

This is a cumulative **source overlay**, not a copy of the entire repository. It includes replacement integration/build files and the complete v8.1 cloud-history feature files. It deliberately does not replace existing 3D world modules, the app's HTML pages, `.git`, `public/assets/`, GLB models, or unrelated application modules.

## Verification boundary

The packaged regression suite passes. The source overlay does not contain every original repository file or the full `node_modules` tree, so it cannot independently prove the full Vite build, actual browser rendering, live Supabase RLS, cross-device cloud sync or Vercel deployment. Those checks must run against the merged repository and configured Supabase project.
