# CALLORIA v7.29 — Workforce Performance Intelligence

## Release purpose

Adds a read-only workforce intelligence panel to the Supervisor workspace. It brings together the local employee profile's retained voice operations, QA, CSAT, shift-adherence and compliance counters with v7.24 digital follow-up performance and the v7.28 career evidence bridge.

## New capabilities

- Employee profile view for inbound/outbound voice volume, inbound resolution rate and average handle time.
- QA score and sample count from retained performance counters.
- Customer satisfaction average on the application's 1–5 scale, with its sample count.
- Shift-adherence average and completed-shift count from retained shift-history entries.
- Exact-ID digital evidence matching using CALLORIA's existing `EMP-<initials>` assignment key.
- Digital agent table preserving responder-level attribution, target achievement, overdue work and at-risk work.
- Career readiness reference for the matched digital agent, without creating or changing career decisions.
- Compliance incident and critical voice-flag visibility.
- Source-coverage reporting and missing-evidence handling.
- A weighted Service Evidence Index using available QA (30%), CSAT (25%), digital response-target rate (25%) and shift adherence (20%). At least two dimensions must be present. The coverage percentage identifies which weights contributed.
- Responsive desktop/mobile layout.

## Data integrity boundaries

- Voice, QA, CSAT and shift figures are the current local employee profile counters, not verified organisation-wide aggregates.
- Digital agent rows keep their existing responding-agent attribution. Digital figures join the current employee profile only when its employee ID matches exactly.
- Other agents remain digital-only until their voice/QA/CSAT/shift records use the same employee ID.
- Shift adherence is not represented as biometric or HR attendance.
- The Service Evidence Index is a descriptive operations signal, not a promotion score or employment decision.
- Missing evidence is displayed as unavailable and excluded from index calculation; it is not treated as zero.
- Compliance shows the local incident register and known critical voice flags. A zero count is not an external audit, legal attestation or certification.

## Technical scope

- New runtime engine: `js/workforce-intelligence-engine-v729.js`
- New Vite transform: `build/calloria-workforce-intelligence-v729.mjs`
- New responsive styles: `styles/calloria-workforce-intelligence-v729.css`
- New tests: `tests/workforce-intelligence-v729.test.mjs` and `tests/vite-config-v729.test.mjs`
- Updated Vite plugin registration after v7.28.
- No new dependency, database migration, Edge Function, secret, environment variable, provider integration or external data transmission.
- Read-only: no existing saved employee, shift, interaction, QA, CSAT, incident or career records are modified.

## Verification status

See `docs/TEST-RESULTS-v7.29.txt` and `docs/RELEASE-STATUS-v7.29.txt`. Full production Vite build and live deployment are not claimed because this workspace does not contain the complete repository with installed dependencies.
