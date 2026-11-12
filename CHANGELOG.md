# v6.15 changelog

- Added DRACOLoader to the office GLB runtime while retaining Meshopt support.
- Pinned the default DRACO WASM decoder URL to version 1.5.7.
- Added an optional runtime override for self-hosted decoder assets.
- Improved per-asset load error category, model path and URL diagnostics.
- Added decoder disposal to scene teardown.
- Kept existing office placement plan and fallback handling unchanged.
