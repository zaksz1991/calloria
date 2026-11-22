# CALLORIA v7.11 — Change log

## Added

- Required structured case outcome evidence in inbound and outbound after-contact work.
- Issue category and primary root-cause classification.
- Recorded action taken and customer-understanding result.
- Factual-notes / sensitive-data handling acknowledgement.
- Disposition-specific validation for resolved, callback, escalated/review, declined, opt-out and no-contact outcomes.
- Evidence object persisted on existing case records; outbound attempt records also receive the evidence object.
- Mobile-responsive evidence controls.

## Preserved

- Existing callback commitment validation and scheduling.
- Existing case lifecycle, queue transitions, campaign retry policy and suppression behaviour.
- Existing QA / CSAT calculation, employee progression, salary and promotion logic.
- Existing local and cloud save pathways; no database migration.

## Not claimed

- No full Vite build was run against the complete user repository.
- No Vercel deployment or physical-device test was performed.
- The plugin's source anchors were matched to the current public `main.js` structure and covered with focused fixtures. The user's deployed branch may differ.
