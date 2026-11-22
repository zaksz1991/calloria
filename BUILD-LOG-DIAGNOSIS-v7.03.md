# Vercel build diagnosis — v7.03

Two independent package-manager issues were visible in the supplied logs:

1. `npm install` removed 23 packages and audited one package because the committed root manifest declared no runtime or build dependencies.
2. npm reported `esbuild@0.25.12`'s `postinstall: node install.js` as not covered by `allowScripts`. Vite 6.4.5 depends on esbuild; the binary setup script is part of preparing the correct esbuild package for the platform.

The first issue explains `npm error Missing script: "build"`. The second can leave an incomplete esbuild installation even after Vite is restored.

v7.03 restores the app manifest and adds a version-scoped allowScripts approval for exactly `esbuild@0.25.12`. npm's documented `allowScripts` field supports package-version-pinned approvals; broad blanket approval is deliberately not used.

The unrelated `Unknown env config "cache-dir"` warning is not changed by this release. It did not cause the missing build-script failure.
