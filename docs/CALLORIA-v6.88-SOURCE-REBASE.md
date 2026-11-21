# CALLORIA v6.88 — public-source audit

Audited public source snapshot: `https://github.com/zaksz1991/calloria/tree/c8a48d6`

## `js/main.js`

- `renderVoicePractice` includes explicit microphone consent, a typed response fallback and a voice privacy notice (around lines 926–949).
- Completed inbound wrap-up constructs a CRM case with `voiceTranscript`, security flags and quality flags; that record is pushed into `state.cases` (around lines 2573–2574).
- Human QA review submission selects transcript evidence and calls `createHumanQAReview`, then stores the resulting review (around line 3271).
- The Workforce promotion panel contains the old manually entered `examScore` input (around lines 1871–1881), and the submit handler passes that value to `recordPromotionExam` (around lines 3328–3332).

The v6.88 transform uses these existing data paths instead of installing another voice-capture or wrap-up workflow.

## `js/qa-workspace-engine.js`

The default scorecard uses six criteria: opening, listening, probing, accuracy, ownership and closing. `createHumanQAReview` requires transcript-backed evidence for each rating, computes the score, marks critical breaches for mandatory review and produces coaching entries for criteria rated 3 or lower (around lines 5–17 and 61–104).

v6.88 consumes that existing review output. It does not manufacture human QA ratings or accept practice scores as QA evidence.

## `js/workforce-engine.js`

The existing promotion model weights KPI 30%, QA 20%, CSAT 15%, knowledge 15%, compliance 10% and leadership 10%. `promotionEligibility` requires fewer than three lifetime attempts, no attempt in the current calendar year and a performance score meeting the configured threshold. `recordPromotionExam` applies a 70% exam pass mark (around lines 46–67).

v6.88 records its automatically scored scenario result by calling this existing function.

## `vite.config.js`

The source snapshot registered separate v6.42–v6.50 transforms after the mobile repair and before the v6.86 RuffNeck service transform. The supplied v6.88 config removes those stale registrations and adds the consolidated career plugin after the RuffNeck transform. Existing GLB, OJT, mobile, employment and visitor plugins remain registered.
