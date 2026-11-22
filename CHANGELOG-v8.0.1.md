# CALLORIA v8.0.1 — Vercel Import-Audit Repair

## Production build failure addressed

The Vercel build at commit `e6336c5` passed install preflight and navigation integrity, then stopped in `calloria-v8-integration-audit.mjs` with 45 alleged missing files. Those reports came from import statements held in string constants by Vite transform plugins. The plugin injects those statements into target files such as `js/main.js`, `js/production-world.js`, and other transformed modules. Their relative paths are relative to the transformed target file, not the plugin's own location under `build/`.

The old raw-text scanner incorrectly treated generated-code strings as real module imports and resolved them from `build/`, creating false missing-file errors before Vite could perform the actual transform and module resolution.

## Changes

- Replaced raw text import matching with a small lexical scanner.
- The scanner ignores comments, quoted strings and template literals.
- It follows only real top-level static `import` declarations and `export ... from` re-exports.
- Transform-added imports are left to Vite/Rollup, which resolve them against the transformed module's actual path.
- Added regression coverage for string anchors, template literals, comments, dynamic imports, side-effect imports and re-exports.
- Retained the v8 plugin order, HTML entry contract, package scripts, Node 22 pin, dependencies and Vercel output configuration.

## Scope

No application runtime feature, database schema, Supabase Edge Function, Vercel variable, dependency or lockfile changed. This is an audit correctness repair, not a change to customer-care or workforce behaviour.

## Verification

- v7.23–v7.31 and v8.0 regression tests in this workspace: 128 passed, 0 failed.
- v8 import-audit regression suite: 9 passed, 0 failed.
- JavaScript syntax: 42 files passed.
- Full Vite production build: not run in the preparation workspace because this is an overlay and does not contain the complete application source or installed dependencies.
- Vercel deployment: not run from this workspace.
