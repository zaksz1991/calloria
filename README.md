# CALLORIA v8.0.1 — Build Audit Repair

This cumulative v8.0 integration overlay corrects the false-positive import graph in the v8 build audit after the Vercel failure at commit `e6336c5`.

The audit now follows actual top-level static imports and re-exports. It no longer mistakes import snippets stored in Vite plugin string constants for imports belonging to the plugin file. Vite/Rollup resolves those transform-added imports after the target file is transformed.

See `INSTALL-GITHUB-v8.0.1.md` for GUI installation and `docs/TEST-RESULTS-v8.0.1.txt` for the verification boundary. This is not a complete repository archive.
