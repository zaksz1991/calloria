# CALLORIA v6.50 — Scenario-based Promotion Examination

This cumulative overlay replaces the self-entered numeric promotion exam mark with a twelve-scenario assessment. It uses scored operational decisions across security/privacy, customer communication, operational judgement, case ownership, CRM documentation, ethical sales and team leadership.

## How the examination works

- The existing Workforce eligibility threshold, one-attempt-per-calendar-year rule, three-attempt lifetime limit and 70% pass mark remain authoritative.
- The candidate must answer all twelve scenarios before submission.
- The score is computed from the selected responses; there is no manual score input.
- The existing `recordPromotionExam()` engine still records the official attempt and pass/fail outcome.
- The attempt now also retains question identifiers, category scores and response points for review. The Career dossier exposes a collapsible competency breakdown for recorded attempts. It does not store free-text or personal customer data.
- The assessment is a local simulation exercise, not a proctored or externally accredited examination.

## Corrected promotion readiness metrics

The v6.49 dossier and Workforce eligibility display now include completed digital contacts in KPI and scored digital interactions in QA, matching the metrics already used when the existing Workforce exam handler validates an attempt. This removes an inconsistency between the readiness profile, Workforce eligibility display and examination submission. The formula now counts resolved and escalated digital contacts in KPI and includes the digital QA mean only when there are scored digital QA records.

## Install

Merge the contents into the repository. Replace `vite.config.js` with the included cumulative configuration. Keep the existing application, public assets, package files, Supabase configuration and environment variables. This overlay adds build-time transformations and tests; it does not include the full application source or GLB assets.

## Verification boundary

Focused Node tests, transformed-fixture syntax and Vite configuration syntax are checked in this package. A full production build, browser exam session, cloud save and Vercel deployment require the complete current repository and have not been verified in this environment.
