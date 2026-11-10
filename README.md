# CALLORIA v3.4 — In-world operations and GLB runtime repair

**Patch type:** additive Vite plugin + exact `vite.config.js` replacement for the current `main` branch configuration checked on 10 November 2026.

This patch is designed to address the failures visible in the user's Android gameplay screenshots without replacing CALLORIA's recruitment, contact operations, CRM, case, QA, performance or career engines.

## What it changes

1. **Draco-compressed staff GLBs:** registers Three.js `DRACOLoader` on the staff GLTF runtime and bundles Three.js's own decoder files under `/draco/`. Existing Meshopt decoding remains enabled. The current runtime explicitly rejected `KHR_draco_mesh_compression`; this patch makes that format decodable instead of rejecting it.
2. **Player pose safety:** the third-person avatar is accepted only when it is a skinned character with at least 12 bones and both recognisable idle and walk clips. An unanimated/default-pose GLB is rejected so the existing first-person controller stays usable instead of displaying a static T-pose avatar.
3. **Work-first access:** adds a compact `OPEN INBOUND DESK` control to the immersive HUD. It routes into CALLORIA's existing inbound view and respects the existing recruitment and shift-entry checks. It does not replace the inbound queue, call handling, CRM, case notes, disposition, QA or performance code.
4. **Mobile tutorial sizing:** constrains the large “Access your workstation” card so it does not occupy most of the phone screen. The card remains scrollable.

## Important boundaries

- This is **not** a replacement for the entire CALLORIA repository and it does not contain new human GLB assets. It fixes decoder registration and rejects invalid player poses; it cannot turn a poor source model into a high-quality human model.
- The GLB office assets still need to be verified in the deployed browser. If the current model URLs are broken, blocked by CORS, or point to low-quality geometry, those assets need separate replacement with licensed first-party models.
- The inbound entry is a shortcut to the existing real simulated work view. It does not bypass employment, the 08:00 shift start, morning briefing or agent availability rules.
- It does not add real PSTN telephony or production customer data. Existing voice/digital features remain simulated and must not be represented as connected to a real bank or customer.
- `vite.config.js` is reconstructed from the current public `main` branch file and only adds this plugin import and registration. Check it against the live branch before replacing it if another commit has landed since the snapshot.

## Apply through GitHub's website (no terminal required)

1. Download and extract this ZIP.
2. Open `https://github.com/zaksz1991/calloria` and make sure the branch selector shows `main`.
3. Upload `build/calloria-in-world-operations-v3-4-plugin.mjs` into the repository's `build` folder using **Add file → Upload files**. Keep the folder path `build/`.
4. Upload `tests/calloria-in-world-operations-v3-4.test.mjs` into the repository's `tests` folder. Keep the folder path `tests/`.
5. Open the existing root `vite.config.js` in GitHub, select Edit, and replace its complete contents with the `vite.config.js` supplied in this ZIP. This preserves the current plugin chain and adds the v3.4 plugin last.
6. Commit the three changed files to `main`.
7. Inspect the resulting Vercel deployment log. Treat the change as deployed only when Vercel reports a successful production build.

## Verification included

The included Node test file checks the source transforms, direct inbound route, mobile tutorial sizing, idempotency and fail-closed behaviour. It is not proof that the full CALLORIA production build, hosted GLB files, browser rendering or a physical phone have passed. Those checks must be performed by the repository's CI/Vercel build and on the actual device after deployment.
