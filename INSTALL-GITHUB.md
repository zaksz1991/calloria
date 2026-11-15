# Installation — CALLORIA v6.57.1

This is a cumulative build-plugin overlay, not a full export of the application repository.

1. Extract the ZIP.
2. Merge the included `build/` and `tests/` folders into the `calloria` GitHub repository, allowing the v6.57 support-router plugin and updated test file to replace their previous versions.
3. Replace the repository-root `vite.config.js` with the included cumulative configuration. Keep the existing project root and Vercel root directory unchanged.
4. Commit and push the changes to `main`.
5. Check the Vercel deployment log. The v6.57 fatal `Could not find the final support-router initial render call` error should no longer occur. If the expected module bindings are unavailable, the plugin will emit a warning and continue the build.

Do not change Supabase variables or package dependencies for this repair.

Important: the supplied Vercel log also shows v6.42–v6.54 safely skipping because their `js/main.js` anchors do not match the deployed source. This ZIP does not claim those features are active; it repairs the v6.57 build blocker only.
