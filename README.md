# CALLORIA v3.7.2 — Office-plan anchor repair

This is a narrow repair for the Vercel failure on commit `aa25c54`.

The v2.9 GLB-first Vite plugin intentionally expands the office GLB coverage plan in an `enforce: "pre"` transform. The v3.7 OJT/Draco plugin runs later and was incorrectly requiring the earlier pre-expansion string literals. v3.7.2 accepts both valid plan shapes and preserves the upstream plan unchanged while attaching Draco decoding to the office loader.

## Files

- `build/calloria-ojt-glb-activation-plugin.mjs` — complete replacement.
- `tests/calloria-v37-onboarding-glb.test.mjs` — complete replacement, including regression coverage for both transformed and untransformed plan shapes.

The unchanged `build/calloria-ojt-runtime.js` is included only so the focused test file can import the plugin in isolation; do not copy or replace it during installation. The patch does not change the OJT runtime, `vite.config.js`, `package.json`, `main.js`, `index.html`, GLB registry or model files.

See `INSTALL-GITHUB.md` and `VERIFICATION.md`.
