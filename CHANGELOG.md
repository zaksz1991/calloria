# v6.17 Changelog

- Activated the full CC0 reception lobby inside the existing production office GLB runtime.
- Added geometry validation and safe material/attribute batching.
- Added device-tier gating: low skips the full lobby; balanced/high attempt it.
- Added full-lobby → standalone reception-desk GLB → procedural reception fallback order.
- Added diagnostics for actual lobby load, validation, batching, placement and licence.
- Added disposal that restores existing reception meshes and releases generated geometry.
- Preserved v6.16 workstation furniture, ergonomic chairs, Draco and Meshopt loader configuration.
