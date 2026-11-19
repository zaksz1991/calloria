# CALLORIA v6.78 — Assessment draft continuity

Recruitment assessment remains the simulator's entry gate. v6.78 improves continuity around that gate without changing the assessment itself.

## Candidate flow

The candidate can exit an assessment deliberately without abandoning recorded answers. The candidate page then exposes a saved-progress card with the current response count, percentage and local save time. Resuming restores the saved question and section. Review edits still return to the review page after the response is saved.

A retake remains a separate operation and starts with empty answer arrays. Submitting records a submission timestamp and a submitted/failed outcome.

## Mobile review action

The mobile assessment dock now recognises the final review's Submit button as well as the aptitude and practical Continue buttons. The dock activates the original application button; it does not own scoring or progression state.

## Data and release boundary

The draft status and timestamps are stored with the existing CALLORIA browser save. No migration or new environment variable is required. The patch does not change question text, answer choices, score thresholds, recruitment outcomes, employment flow, 3D assets or operations modules.
