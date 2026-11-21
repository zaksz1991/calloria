# Build-log diagnosis and repair scope

## Fatal Vercel error

The supplied build stopped in `build/calloria-third-person-player-plugin.mjs` while transforming `js/production-world.js`:

`expected exactly one combined GLB-ready callback anchor (0 found)`

The existing plugin was coupled to an older combined GLB-ready callback. The current world source exposes a different first-render/readiness flow. v6.85 replaces that transform with a compatibility-aware plugin. This cumulative package includes that replacement and the v6.84 world plugin it is designed to work with.

## Non-fatal integration skips visible in the same log

The log also showed source-anchor mismatches for v4.4 and v6.42–v6.54 integrations. The v6.44–v6.50 chain then skipped because its v6.42–v6.45 prerequisites were absent. Those skip warnings were not the fatal error in the supplied log.

v6.86 specifically rebases and consolidates the RuffNeck v6.51–v6.54 service chain because its old anchors no longer matched the current main.js. The unrelated v4.4 and v6.42–v6.50 integrations are retained and are not repaired by this release. Their warnings may remain until their own source rebase is completed.

## Remaining risk

A successful source-level transform and passing regression suite do not prove that every remaining Vite plugin will build against the complete repository. The next Vercel result is the definitive build verification.
