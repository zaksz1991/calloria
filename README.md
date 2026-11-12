# CALLORIA v6.17.1 — Reception Lobby Export Repair

Fixes the exact Rollup error from the Vercel build: `production-world.js` imports `integrateCalloriaCC0Lobby`, while the v6.17 module exported the implementation under the longer name `integrateCalloriaCC0OfficeLobby` only.

The implementation is unchanged. A backwards-compatible named export now aliases the existing implementation, preserving its arguments, status events, fallback visibility, and disposal lifecycle.

## Install
Replace only `js/cc0-office-lobby-integration.js` with the file in this package. Keep all other v6.17 files and existing repository files unchanged.

## Verification
Focused export-contract tests and JavaScript syntax check are included. This is a targeted repair; the full repository Vite build and deployed browser rendering have not been run here.
