# Vite change summary — CALLORIA v7.22

The supplied root `vite.config.js` is a complete replacement matching the public `main` configuration reviewed for this release.

Only two functional changes are made to that baseline:

1. Import `calloriaDigitalExperienceSuitePluginV722` from `./build/calloria-digital-experience-suite-v722.mjs`.
2. Add `calloriaDigitalExperienceSuitePluginV722()` as the last plugin registration after `calloriaTryItStudioPlugin()`.

All existing world/GLB/OJT/mobile/workforce/visitor plugins, Rollup HTML entry points, output naming, Three.js chunking, server and preview settings are preserved.
