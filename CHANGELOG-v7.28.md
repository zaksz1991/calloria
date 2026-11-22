# CALLORIA v7.28 — Workforce Career Evidence Bridge

## Purpose

v7.28 connects the digital follow-up performance and coaching sequence (v7.23–v7.27) to a traceable supervisor career-review workflow.

## Added

- A combined agent dossier for retained Email, Live Chat and Social follow-up evidence.
- A transparent readiness score and status for each agent.
- Minimum evidence gates: at least 10 completed digital follow-up responses, at least 85% completed-response target achievement, zero overdue open follow-ups, no more than one at-risk follow-up, and no active coaching plan.
- Completed coaching outcome and 30-day sustainment checks are included where an agent has completed a coaching plan. An unreviewed outcome, missing 30-day checkpoint, negative outcome, or recorded regression blocks review readiness.
- A supervisor can prepare an immutable career evidence packet for an agent who meets all gates.
- The packet requires a named supervisor and at least 20 characters of evidence-based review notes.
- Supervisor decisions: refer for formal promotion-exam eligibility review, defer for continued development, or not recommend at this review.
- Career review activity is recorded in the existing operations timeline.
- Responsive supervisor panel for desktop and phone layouts.

## Decision boundary

The readiness signal is limited to retained synthetic digital follow-up data. It is not a complete performance appraisal and does not make a promotion, disciplinary, salary, role or employment decision. A referral only sends the evidence to the existing formal career process. Existing performance eligibility checks, annual exam procedure and three-attempt limit remain mandatory. No `promotionAttempts`, role, salary or employment fields are changed by v7.28.

## Configuration

- No database migration.
- No Supabase Edge Function or secret change.
- No environment variable or package dependency.
- No live customer or provider data is transmitted by the new engine.

## Release type

Cumulative overlay for the v7.23–v7.27 digital follow-up supervisor, performance, coaching, outcome and checkpoint modules, plus v7.28. It is not a complete CALLORIA repository snapshot.
