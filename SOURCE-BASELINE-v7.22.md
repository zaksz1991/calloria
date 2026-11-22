# Source baseline — CALLORIA v7.22

Baseline reviewed: public `main` branch, 22 November 2026.

## Confirmed repository state

1. `package.json` on public `main` declares Node `22.x`, the build/prebuild/postbuild scripts, Vite `6.4.5`, Three.js `0.170.0`, Supabase JS `2.119.0`, esbuild `0.25.12`, and the pinned esbuild install-script approval. The previous v7.00–v7.04 manifest recovery is therefore present in the current public manifest.
2. `vite.config.js` imports the world, GLB, OJT, mobile, workforce, visitor and Try It Studio plugins. Its plugin array ends with `calloriaTryItStudioPlugin()` and does not register the v7.20 or v7.21 digital plugin.
3. `build/calloria-digital-workflow-suite-v720.mjs` exists and composes the v7.15–v7.18 transforms with the v7.20 disposition evidence transform.
4. `build/calloria-digital-response-cycle-v721.mjs`, `js/digital-response-cycle-engine-v721.js`, and `styles/calloria-digital-response-cycle-v721.css` exist in public `main`.
5. The current `js/main.js` contains the v7.21 import, `activeSlaClass`, `renderDigital()` and digital thread insertion anchors used by the v7.21 transform.

## Change in this release

The complete replacement `vite.config.js` preserves the current plugin imports, registration order, multi-page Rollup input and output naming. It adds one import and one final call to `calloriaDigitalExperienceSuitePluginV722()`.

## Public source references

- `https://raw.githubusercontent.com/zaksz1991/calloria/main/package.json`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-digital-workflow-suite-v720.mjs`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/build/calloria-digital-response-cycle-v721.mjs`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/digital-response-cycle-engine-v721.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/styles/calloria-digital-response-cycle-v721.css`
