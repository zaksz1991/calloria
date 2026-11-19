# CALLORIA v6.76 — Recruitment Progress Recovery & Final Response Review

## Purpose

v6.75 addressed the candidate viewport problem: assessment choices and the Continue control were obscured or separated by the 3D workplace and fixed application navigation. v6.76 addresses the next failure points in the same journey: candidates could not move backward to correct a response, did not receive a final consolidated review, and had no explicit checkpoint guarantee for a page reload during an attempt.

## Candidate flow

1. Candidate application.
2. Seven aptitude and judgement questions.
3. Three practical customer-call stages.
4. Final response review showing all ten selected responses.
5. Edit any aptitude or practical response and return directly to final review.
6. Submit once all responses pass the completeness and option-index checks.
7. Existing recruitment score, critical-breach decision, retake or employment offer.

## Behaviour and preservation

- Back navigation crosses the aptitude/practical boundary and retains all answers.
- A review edit opens the exact question or practical stage. Continue saves the change and returns to review rather than marching through the remainder of the assessment.
- `assessment-flow-engine.js` owns deterministic forward/back/review-jump transitions and builds a display-only review model.
- The final review checks answer indexes against the actual question option arrays. Missing or stale/out-of-range values cannot be submitted.
- Answer selections and navigation checkpoints are written through the existing CALLORIA profile save path. Guest progress remains in the existing browser profile; the existing cloud-employment save path is not replaced.
- The existing scoring function remains the sole owner of scoring and recruitment decisions. Review does not reveal correct answers or alter points.
- The mobile assessment dock now recognises `assessment-submit`, allowing the final review action to be used on touch devices.

## Scope boundaries

This release does not change the seven-question aptitude bank, the three practical-call stages, answer labels, point values, critical breach flags, existing pass threshold, retake flow, employment offer or the 3D workplace. Recruitment remains an entry gate; the main game remains employed agent work and career progression.

No database migration, environment variable, secret, dependency or GLB asset is required.
