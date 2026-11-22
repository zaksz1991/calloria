# Build and test notes — v7.14

- The repository-wide package scripts were not run because the full CALLORIA repository was not attached to this session.
- The isolated 13-test Node regression suite was run directly against the new v7.14 files.
- The Vite plugin source was syntax-checked.
- Both transformed source fixtures were passed through Node's parser with `node --check`.
- The new Vite plugin is intended to be registered last so it sees the final state of the two target source modules.
- No network calls, real customer calls, Supabase writes or live account changes occur in the v7.14 helper.
