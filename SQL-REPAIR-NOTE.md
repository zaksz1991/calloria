# Phase 20 SQL repair

The original migration failed while PostgreSQL parsed the daily-trend CTE. It used `day` as an implicit column alias after a cast (`::date day`). PostgreSQL rejected that alias in this position.

The corrected migration uses an explicit set-returning-function table alias and the non-ambiguous column name `calendar_day` throughout the CTE and joins. The JSON response key remains `day`, so the dashboard response contract is unchanged.

## Apply

Use the complete corrected file:

`supabase/migrations/202611080020_calloria_operations_intelligence.sql`

Do not apply only the replacement CTE. The full migration also creates the supporting indexes, defines the aggregate snapshot function, and applies its execute grants.

The migration's index statements use `IF NOT EXISTS` and the function uses `CREATE OR REPLACE`, so re-running the complete migration after a failed parse is safe for this migration's objects. Do not rerun migrations 001–019.

This repair has been checked with static SQL-block assertions, the 149-test Node suite, JavaScript syntax checks, and ZIP integrity checks. It has **not** been executed against a live PostgreSQL/Supabase database in this environment.
