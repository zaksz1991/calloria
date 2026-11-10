# CALLORIA v3.8.2 — Office GLB Runtime Syntax Repair

## Root cause

The v3.8.1 office-loader transform used a JavaScript replacement-string template containing escaped `\\n` sequences. `String.prototype.replace` interpreted `$&` as the matched line but emitted the escaped newline text literally, inserting `\\n` into `glb-office-world-integration.js`. Rollup then failed parsing the transformed module with `Expected unicode escape`.

## Repair

- Replaced replacement-string injection with a callback that builds inserted source lines and joins them with actual newline characters.
- Applied the same safe approach when the office loader requires both Meshopt and Draco setup.
- Removed the duplicate `MARKERS` property from the plugin's test API export, eliminating the build-time duplicate-key warning.
- Preserved the workstation plan and existing GLB integration behaviour.

No application runtime, HTML, package manifest, Vite configuration, database, or GLB binary is changed.
