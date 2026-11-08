# CALLORIA Phase 20 SQL repair

Replace the migration copy you previously used with the complete corrected `202611080020_calloria_operations_intelligence.sql` in this archive. The change fixes the daily trend CTE alias: `day` is replaced with explicit `calendar_day` aliases; the generated series column has a named alias. The response JSON property remains `day`.

Apply the complete migration file, not just the edited CTE. The migration uses `CREATE INDEX IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION`, making a rerun safe after a failed parse. Do not rerun migrations 001–019.

Static checks and 149 included tests passed. A live PostgreSQL/Supabase migration was not executed here.
