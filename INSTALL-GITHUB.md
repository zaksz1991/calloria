# GitHub installation — CALLORIA v6.21

Apply this overlay on top of v6.20.

Replace these two files in `github.com/zaksz1991/calloria`:

1. `js/cc0-office-lobby-integration.js`
2. `js/calloria-lobby-lighting-policy.js`

Commit both replacements to `main` in the same commit. Do not replace `vite.config.js`, `package.json`, the lockfile, `js/production-world.js`, any Supabase settings, or any GLB assets.

The remaining files in the ZIP are release notes and focused regression tests. They are not required by the runtime unless you want to keep the project test suite in sync.
