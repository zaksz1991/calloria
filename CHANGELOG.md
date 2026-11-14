# CALLORIA v6.46 — QA Coaching Follow-through

## New functionality
- Saving a human QA review now creates linked coaching action plans for each criterion rated 0–3.
- A review carrying a critical compliance flag also creates a mandatory compliance-remediation plan.
- Each plan records the originating review and interaction, reviewer/coach, criterion, transcript evidence and a seven-day follow-up date.
- The QA workspace now shows an action-plan register with open, delivered and verified counts.
- Reviewers can record that coaching was delivered, then submit documented follow-up evidence.
- A positive follow-up closes the action as verified. A follow-up requiring more practice reopens it.
- Stored content is HTML-escaped in the review display. No automatic employee score, discipline or promotion decision is introduced.

## Integration
- Extends the current v6.45 human QA review workspace and existing `createCoachingRecord` workflow.
- No new package dependency, database migration, API key, Supabase setting or asset is required.
