# Employment persistence live verification checklist

Use synthetic test accounts and synthetic data only.

1. Apply tenancy migration 001, then employment persistence migration 002.
2. Authenticate as an active member and save a snapshot through `save_calloria_employment_snapshot`.
3. Confirm the row has the current organisation ID and authenticated user ID.
4. Confirm a second ordinary agent cannot select the first agent's row.
5. Confirm a supervisor/manager with `operations:read` can read records permitted by the RLS policy.
6. Confirm a user who is not an active member receives permission denied from the save RPC.
7. Confirm a payload above 900 KB is rejected.
8. Confirm organisation deletion cascades to employment records.
9. Confirm separate organisations never share snapshots.
10. Test reload restoration and a second browser session; document last-write-wins behaviour.
