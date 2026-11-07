# CALLORIA v1.2.0

## Human QA & Supervisor Intelligence

- Added a dedicated Quality Assurance workspace accessible from management navigation.
- Added a versioned, weight-configurable six-dimension human QA scorecard; criterion weights must total exactly 100%.
- Added manual review of completed synthetic Customer Lab interactions.
- Added transcript-line evidence selection for every scored criterion; evidence must match the saved interaction transcript.
- Added weighted human scores, mandatory-review precedence for critical conduct/security breaches, and review status labels.
- Added evidence-linked coaching actions for criteria rated 3/5 or lower.
- Added a dispute workflow with substantive reason validation, duplicate-open-dispute prevention, independent resolution notes, upheld/adjusted decisions and explicit adjusted-score validation.
- Added reviewer calibration across independent reviews of the same interaction and scorecard, including per-criterion spread and discussion flags.
- Added QA metrics and audit events for review, dispute and calibration activity.
- Added completed Customer Lab transcript retention to enable later evidence-based review.
- Added regression tests for scorecard validation, transcript evidence, weighted scoring, critical-breach handling, disputes, calibration and UI wiring.

## Data and operational boundaries

- QA records are included in the existing employment snapshot and therefore follow its current user-and-organisation cloud snapshot behaviour when cloud sync is configured. They are not stored in a dedicated QA table.
- Reviewer identity is manually entered in the UI. This release does not implement shared supervisor RBAC, reviewer assignment, dual-control approval or an immutable enterprise audit ledger.
- Evidence is linked to transcript lines, not playable call audio. Voice recordings remain temporary browser-memory samples and are not attached to Customer Lab records.
- Scorecard criterion labels are based on the standard six dimensions; this release lets administrators configure their weights and version the scorecard, but does not provide arbitrary criterion authoring.
- Dispute adjustments are recorded as resolution outcomes; they do not overwrite the original reviewer score.
- All customer and interaction records remain synthetic training data.
