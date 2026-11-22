# CALLORIA v7.17 — build and test notes

## Automated checks completed

- 16 focused Node regression tests passed.
- `node --check` passed for the helper module and Vite plugin.
- The main-source transform was exercised against a fixture containing the exact current source anchors.
- The transformed fixture passed JavaScript syntax validation.
- Repeated transformation is idempotent.
- Source-anchor drift produces a controlled error and no partial transform.
- CSS integration import, narrow-screen rules and hidden-state behaviour were checked.

## Not performed

- A full repository `npm install` or `npm run build` was not run because a complete current repository checkout was not available in this workspace.
- A live Vercel deployment was not performed.
- Browser interaction and physical phone testing were not performed.

The 16 passing checks verify the isolated v7.17 module/transform behaviours. They do not certify full production integration. Confirm the full Vite build and the in-game supervisor workflow after merging into the current repository.
