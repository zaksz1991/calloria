# Changelog — CALLORIA v7.21

## Digital Follow-up Response Cycle SLA

### Added
- Independent assessment of customer turns after the first agent response.
- Per-turn response due time, elapsed time, remaining time and overdue duration.
- 75% early-warning threshold.
- Channel and queue aggregates for open, at-risk, overdue, met and late cycles.
- Active digital thread panel showing the latest follow-up response cycle.

### Safety and integrity
- The original first-response SLA and its stored fields are not rewritten.
- The feature is read-only and does not mutate messages or contact records.
- Consecutive customer messages before an agent reply are grouped into one pending cycle.
- Invalid or out-of-order timestamps are excluded instead of being treated as successful responses.
- Source transformation validates all insertion anchors before changing `main.js` and skips safely on source drift.

### Compatibility
- No Supabase migration, environment variable, package dependency or saved-state schema change.
- Can be registered after the v7.20 Digital Workflow Suite if that overlay is installed; it does not import or require v7.15–v7.20 plugins.
