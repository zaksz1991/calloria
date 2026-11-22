# CALLORIA v7.31 — Workforce Trend & Evidence History

## Purpose

v7.31 adds a repeatable, aggregate-level evidence history to the v7.30 Workforce Intelligence Command Centre. Supervisors can capture a baseline, return later, and compare current command-centre values with the last saved snapshot.

## New functionality

- Manual capture of workforce snapshots from the current v7.30 command-centre board.
- Overall comparisons for completed replies, open work, overdue work, at-risk work and response-target rate.
- Workstream comparisons for Voice, Email, Live Chat and Social when both snapshots contain the corresponding evidence.
- Department comparisons only for groups explicitly mapped in the source data.
- New channel or department groups are labelled as new; no prior value is invented.
- Missing values remain unscored rather than being treated as zero.
- Snapshot history is chronologically ordered, timestamp-deduplicated and capped at 90 entries.
- Browser-local CSV export and an explicit clear-history action.
- Responsive trend, workstream, department and recent-history tables.

## Data handling

Snapshots store aggregate counts, rates, workstream labels and explicitly mapped department names. They exclude individual agent IDs, customer details, case references and interaction transcripts. History is stored in browser localStorage on the device used to access the supervisor workspace. It is not uploaded to Supabase, synchronised across devices, or shared with other users; anyone with access to the same browser profile may also access its saved history. The capture is manual; v7.31 does not create automatic scheduled snapshots.

## Interpretation limits

Trend signals indicate the direction of change between two captured states. They do not establish causation, represent continuous monitoring, validate data completeness outside the source board, or replace an official workforce report. New or missing data is labelled as such. Department comparisons continue to depend on explicit department mappings.

## Configuration and compatibility

- Adds no Supabase migration or Edge Function.
- Adds no environment variable, credential, API key or npm dependency.
- Adds the v7.31 Vite transform after the v7.30 command-centre transform.
- Retains all earlier v7.23–v7.30 workforce overlay modules and tests in this cumulative package.

## Verification

- 121 automated tests passed; 0 failed.
- 38 JavaScript/MJS files passed syntax validation.
- The generated v7.23–v7.31 transform chain passed the integration syntax test.
- Full Vite production build, live browser rendering, physical-device testing and Vercel deployment were not performed.

See `docs/TEST-RESULTS-v7.31.txt`, `docs/TEST-EXECUTION-v7.31.txt` and `docs/RELEASE-STATUS-v7.31.txt`.
