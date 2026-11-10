# CALLORIA v3.8.2 — Office GLB Runtime Syntax Repair

This is a narrowly scoped build repair for the failure reported at commit `74e0582`.

The v3.8.1 plugin inserted literal backslash-n characters into the transformed office GLB module. This release changes the injection to a callback-based replacement that writes real line breaks and checks the transformed module with Node's JavaScript parser.

## Files

- `build/calloria-ojt-glb-activation-plugin.mjs` — complete replacement.
- `tests/calloria-v37-onboarding-glb.test.mjs` — complete replacement regression suite, including a real parser check of the transformed office module.

`build/calloria-ojt-runtime.js` is included as the plugin's adjacent runtime dependency and is unchanged. Do not overwrite the repository copy unless its contents differ; it is included to make the package self-contained for inspection.

## Scope boundaries

Do not replace `vite.config.js`, `package.json`, `package-lock.json`, `main.js`, `index.html`, any application runtime module, database migration, or GLB binary with this patch.

## Install through GitHub Desktop

1. Extract this ZIP in File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop and choose **Repository → Show in Explorer**.
3. Copy the included `build/calloria-ojt-glb-activation-plugin.mjs` into the repository's `build` folder, replacing that exact file.
4. Copy the included `tests/calloria-v37-onboarding-glb.test.mjs` into the repository's `tests` folder, replacing that exact file.
5. Review the two-file change and commit it to `main`.
6. Push to GitHub and inspect the new Vercel build log.

This ZIP is a targeted patch, not a complete project snapshot.
