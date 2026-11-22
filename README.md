# CALLORIA v8.1 — Organisation Workforce Trend Sync

This additive release extends v7.31 browser-local trend history with an explicit, permission-checked Supabase organisation sync option.

## Main behaviour

- **Save local history to organisation:** uploads up to 90 validated snapshots to the active CALLORIA organisation.
- **Load and merge organisation history:** loads the last 90 organisation snapshots, merges them with local history, removes duplicate capture times and stores the merged result in the current browser.
- Guest mode remains local-only. Sign-in and organisation workspace membership are required for cloud actions.
- Local history is not uploaded automatically.

## Privacy and permissions

The database RPC reconstructs each snapshot from a strict allow-list and ignores any additional client-supplied properties. Persisted fields are aggregate totals, workstream labels/measures, department labels/measures, snapshot timestamp and schema/source version. No employee identifiers, customer details, case references, transcripts or narrative notes are persisted.

Reads and writes require the existing organisation `reports:read` permission. Direct authenticated table writes are revoked. Supabase RLS checks membership scope. The last 90 snapshots are retained per organisation.

## Package type

This ZIP is an additive overlay for the v8.0.1-integrated CALLORIA `main` baseline, not a complete copy of the full repository. It includes complete replacement `vite.config.js` and `package.json` files plus new plugin, engine, CSS, tests and SQL migration. Preserve all other repository files, `.git`, `public/assets/`, GLB models, credentials and Supabase configuration.
