# CALLORIA v4.4.0 — Verification report

## Checks run in the patch workspace

- Focused v4.4 regression tests: **19 passed, 0 failed**.
- `node --check` for `js/operational-conversation-engine.js`: passed.
- `node --check` for `build/calloria-first-working-shift-v4-4-plugin.mjs`: passed.
- `node --check` for `vite.config.js`: passed.
- The transform integration test compiles the transformed `main.js` fixture with Node's parser: passed.
- Idempotency, mismatch fail-safe, CRM transcript persistence, critical compliance handling and industry-neutral scenario tests: passed.
- ZIP integrity: checked after packaging.

## Not verified

- Full repository `npm test`.
- Full `npm run build` / Vite production build.
- Vercel deployment.
- Real browser rendering against the complete deployed repository.
- End-to-end recruitment → OJT → trainer sign-off → briefing → first shift → CRM case workflow in the browser.
- Actual Android/iOS device layout, browser speech playback or GPU/3D scene interaction.
- Actual GLB model rendering. This upgrade does not repair the outstanding GLB visual integration.

## Compatibility basis

The complete Vite configuration and integration anchors are based on the public repository source at commit `74e0582`, which was the commit in the user's latest supplied Vercel build log. The v4.4 plugin is registered after the existing OJT/GLB Vite plugin so it can transform the OJT-gated application output. If the repository has advanced beyond that source shape, the new plugin deliberately warns and skips rather than applying a partial transform.
