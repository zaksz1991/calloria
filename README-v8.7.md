# CALLORIA v8.7 — Guided Cloud Recovery

This release extends the v8.6 Workforce Cloud Sync Diagnostics panel with actionable, privacy-safe recovery guidance.

After a cloud health check, the Supervisor workspace now displays ordered remediation cards for each failed or warning check. Operators can copy the instructions. When the only issue is a stale or unconfirmed Supabase session, an explicit button can request a session refresh and rerun diagnostics.

The release does not modify workforce snapshots or conflict records. It does not apply database migrations, change organisation roles, disable RLS, or restore a backup. Database/schema actions remain administrator-controlled.

## Install

Follow `INSTALL-GITHUB-v8.7.md`. Only files listed in `UPDATED-FILES.txt` are changed or added. Preserve all unlisted project files, `.git`, `public/assets/`, GLB models, local environment files and Supabase configuration.

## Checks performed

- 11 new focused Node regression checks passed.
- JavaScript syntax checks passed for the updated plugin, both audit tools and new remediation engine.
- The v8.7 Vite transform smoke test emitted a transformed main module with the recovery controls; the emitted module passed `node --check`.
- ZIP integrity was checked after packaging.

The complete repository regression suite, Vite production build, live Supabase authentication, live organisation RLS and in-browser/phone testing have not been performed in this preparation environment. Do not treat this package's focused tests as proof of production deployment.
