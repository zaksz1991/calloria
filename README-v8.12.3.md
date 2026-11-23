# CALLORIA v8.12.3

A small integration overlay that protects the v8.12.2 migration-neutrality repair from regression.

It adds a build-gated test proving that the v8.11 local report verifier behaves the same whether a Supabase migrations directory is absent or already contains earlier CALLORIA/shared-product migrations. Existing SQL files are checked byte-for-byte before and after the verifier runs.

The overlay keeps the existing Vercel package contract and dependencies unchanged. It adds no database or deployment configuration.

See `INSTALL-GITHUB-v8.12.3.md` before merging into the existing CALLORIA repository.
