# CALLORIA v3.9.0 — Verification report

## Checks completed in the patch workspace

- `node --check build/calloria-cc0-staff-glb-bundle-plugin.mjs`: passed.
- `node --check vite.config.js`: passed.
- `node --check tests/calloria-v39-cc0-staff-glb.test.mjs`: passed.
- Focused regression suite: **9 passed, 0 failed**.
- Synthetic GLB v2 parser tests: passed for rig, joints, Idle/Walk clips, triangle budget, truncated length, external URI rejection.
- Mocked buildStart integration: passed; five local target paths and provenance manifest written.
- Partial upstream failure: passed; only validated IDs are selected and failures are listed in the manifest.
- Complete upstream network failure: passed; build hook remains non-fatal and does not alter the original candidate list.
- Existing valid local model preservation: passed.
- ZIP integrity: checked after packaging.

## Not verified

- Actual Gobkit binary downloads from the Vercel build machine.
- Real model appearance, proportions, skin deformation or animation in the Three.js browser renderer.
- Full repository `npm test`.
- Full Vite production build.
- GitHub commit or Vercel deployment.
- Android/iOS device frame rate and memory.
- Actual office desk/computer/headset GLB binaries. This release only bundles staff characters.

## Acceptance boundary

Passing these focused tests verifies the downloader, structural validator, manifest and candidate activation against synthetic GLB fixtures. It does not certify the external binary contents or live browser rendering. The deployed manifest plus actual nonzero `GLB STAFF` replacement status and visual review are required before claiming the staff GLB milestone complete.
