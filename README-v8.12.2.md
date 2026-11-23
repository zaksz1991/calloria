# CALLORIA v8.12.2

This is a narrow test-only repair for the v8.12.1 production build failure reported from Vercel commit `6887618`.

The v8.11 test incorrectly required the entire `supabase/migrations/` directory to be absent. That is incompatible with the actual long-lived CALLORIA/Supabase repository, where prior migrations must remain present. The v8.11 verifier itself is still required to remain local-only and must not introduce schema or secret dependencies.

Replace only the listed test file. Do not remove or replace any existing Supabase migration, application source, asset, package setting, Vite plugin or Vercel configuration.
