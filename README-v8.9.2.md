# CALLORIA v8.9.2 — Vercel v8.6 Cloud-Health Package Contract Repair

The Vercel log for commit `1a71ee7` shows that install and the build preflight passed, then the central v8 integration audit stopped because `package.json` no longer exposed the required v8.6 read-only cloud-health regression command.

This overlay restores the exact package script required by `tools/calloria-v8-integration-audit.mjs`:

`verify:workforce-cloud-health`: `node --test tests/workforce-trend-cloud-health-v806.test.mjs`

The repair does not modify `prebuild`, `check`, the Vite scripts, dependencies, Node pin, plugin registrations, Supabase configuration, migrations, secrets or environment variables.
