# CALLORIA v6.88 — build-log diagnosis and change scope

## Previous supplied Vercel failure

The supplied log was from commit `c8a48d6`. It failed when `calloria-ruffneck-service-operations-v6-86` demanded three anchors that did not match the current `main.js`: applicant default track, applicant default department and a Workforce insertion anchor. The preceding v6.87 repair makes the two applicant defaults optional when upstream code has already changed them and inserts the panel at the current System activity heading.

## Warnings retired in v6.88

The same log showed the v6.42–v6.50 plugin chain skipping because its old voice, dialogue, wrap-up, QA, coaching, competency and promotion source anchors no longer exist in their expected form. The current `main.js` already contains the consent-led voice response form, transcript/wrap-up workflow, human QA review handler and the native promotion form/handler. The revised Vite config unregisters the obsolete v6.42–v6.50 chain and registers one source-aware v6.88 integration after the RuffNeck service transform.

The old plugin source files are not deleted. They are simply no longer called by Vite.

## v6.88 integrations

1. On completed inbound wrap-up, the existing voice transcript is copied into `state.customerQaHistory` for the existing human QA workspace. Empty lines are removed and the existing voice text sanitizer is applied before the QA record is created. Security flags are passed as critical review markers.
2. When a human QA review is saved, the low-rated criteria already produced by `createHumanQAReview` become evidence-linked coaching actions. Duplicate actions for the same review and criterion are suppressed.
3. The Career competency passport calculates six competencies from the existing scorecard criteria: opening, listening, probing, accuracy, ownership and closing. It distinguishes awaiting evidence, development required, developing and demonstrated levels.
4. Guided practice uses a separate answer-scored practice bank. Practice cannot alter a human QA review. A passed action enters a pending coach-signoff state; a named coach must record a decision and evidence notes before the action is signed off.
5. The manual numeric promotion score is replaced by five scenario questions. The result is sent through the existing `recordPromotionExam` function and current organisation policy. No new promotion eligibility policy is created.

## Deliberate non-changes

- No GLB files, world geometry, Supabase schema, API keys, production customer data or payment systems are modified.
- The prior v6.84 non-blocking workplace GLB startup and v6.85 third-person/workstation transform repairs are carried forward.
- The v3.8 legacy GLB callback warning and v4.4 first-independent-shift skipped-transform warning are not repaired in this release.

## Verification boundary

The package's 67 automated regression tests, targeted transform fixture syntax check, JavaScript syntax checks and ZIP integrity check pass. A complete project checkout, full Vite production build, Vercel deployment, actual model download/placement, and physical Android/iOS testing were not available for this package. The next Vercel build log is still required to establish whether the full production pipeline succeeds.
