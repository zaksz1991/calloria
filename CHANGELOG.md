# v2.9 changelog

- Expanded low-tier workstation GLB coverage to the two front-centre workstations and added one headset.
- Expanded balanced-tier workstation GLB coverage to all four front-row stations.
- Expanded high-tier workstation GLB coverage to eight front and middle-row stations.
- Kept the existing actual model validation, one-time source loading, shared clone resources, fallbacks and cleanup logic.
- Reused the already-registered Vite plugin; no Vite config or application entry-point changes.
- Added regression tests for tier coverage, station bounds, idempotence and transform scope.
