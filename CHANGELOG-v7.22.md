# Changelog — CALLORIA v7.22

## Digital feature activation and consolidation

- Added `calloriaDigitalExperienceSuitePluginV722()` as the single Vite registration for digital workflow transforms.
- Composes the existing v7.20 suite followed by the v7.21 response-cycle transform.
- Preserves v7.20 handling of both `js/main.js` and `js/multichannel-engine.js`.
- Ensures v7.21 is only attempted after the v7.20 disposition-integrity marker is present in `main.js`.
- Keeps a successful v7.20 transformation if v7.21 anchors drift; the response-cycle layer then skips safely with a warning.
- Adds an idempotent combined plugin and compatibility tests for already-transformed v7.20 source.
- Replaces `vite.config.js` with a complete source-matched version that preserves the existing plugin registrations and adds exactly one v7.22 registration after Try It Studio.
- Carries forward the v7.20 and v7.21 source dependencies and regression suites in one package.
