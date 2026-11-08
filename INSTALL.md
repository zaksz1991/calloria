# CALLORIA Optimized GLB Deployment — v2

This update closes the gap between producing optimized workflow artifacts and actually using them in the Vercel application.

## What this changes

1. Adds `MeshoptDecoder` to both existing GLTFLoader paths through a version-checked Vite build plugin.
2. Allows `EXT_meshopt_compression` models; continues to reject required Draco compression because the application does not configure DRACOLoader.
3. Adds manifest-based loading: when a promoted optimized model is deployed, CALLORIA loads it first. If the manifest is absent, the optimized model is missing, or decoding fails, it loads the original GLB.
4. Updates the manual optimization workflow to place only genuinely optimized copies under `public/assets/models-optimized/`, write a deterministic manifest, and publish that folder to the selected branch. Original models under `public/assets/models/` are never modified.
5. Upgrades GitHub Actions to current Node 24-compatible major releases to eliminate the Node 20 deprecation warning from the prior run.

## Files to add

- `build/calloria-optimized-glb-runtime-plugin.js`
- `js/glb-optimized-asset-runtime.js`
- `tools/promote-glb-optimized-assets.mjs`
- `tests/calloria-optimized-glb-runtime.test.mjs`
- `tests/glb-promotion.test.mjs`

## Files to replace completely

- `vite.config.js`
- `.github/workflows/calloria-glb-asset-optimization.yml`

Keep `package.json`, lockfiles, `build/calloria-glb-world-plugin.js`, all existing `js/` modules, `js/main.js`, `js/production-world.js`, original GLB files, and Supabase files unchanged.

## After adding the files

1. Commit the files to branch `main`. The updated workflow starts automatically because the commit changes one of its watched source paths; no separate Run workflow click is required. You can also run it manually from GitHub Actions.
2. The workflow audits the original GLBs, creates conservative optimized candidates, rejects candidates that do not meet the existing structural/savings checks, and packages the report artifact.
3. It then commits only the accepted optimized files and manifest to `public/assets/models-optimized/`. This requires the repository's Actions `GITHUB_TOKEN` to have contents write permission. If repository Actions settings or branch protection disallows that push, the run will report a push error and retain the uploaded artifact; no original files are changed.
4. The new GitHub commit should trigger the repository's existing Vercel Git deployment. After deployment, CALLORIA will prefer optimized models listed in the manifest and fall back to original files on any optimized-load/decode failure.

## Verification

The included tests cover the exact source transforms, Meshopt decoder registration, manifest-first loading, original fallback, safe promotion paths, and preservation of originals. They do not replace the actual GitHub Actions run, Vercel build, or browser render check.
