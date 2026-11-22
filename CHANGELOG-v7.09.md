# CALLORIA v7.09 — First Shift Mentor & Evidence Review

## Purpose

Complete first-shift supervision after existing OJT and workstation allocation, without duplicating recruitment or onboarding modules.

## Changes

- Listens to the existing `calloria:game-shift-started`, `calloria:game-call-connected` and `calloria:game-case-saved` events.
- Initializes or upgrades the existing `state.onboarding.firstWorkingShift` record for non-grandfathered hires.
- Persists connected-contact IDs, saved case references, QA, disposition, resolved status and compliance-breach evidence in the current employment profile.
- Requires two resolved cases with QA >= 70 and no recorded breach for mentor review.
- Requires coaching acknowledgement and a written reflection after low QA, missing QA or a recorded breach; earlier evidence is retained.
- Requests a simulated mentor review and requires four attestations before sign-off.
- Displays a responsive progress / signed-off card on overview and relevant operational views.
- Skips safely if upstream First Shift or OJT markers and render anchors do not match; no partial source transform is applied.

## Explicit non-changes

- Does not recreate recruitment, product knowledge, CRM practice, shadowing, supervised practice, trainer approval, workstation allocation or briefing gates; those already exist.
- Does not alter real shift eligibility, production QA scores, customer case status, salary, incentives, promotion metrics, Supabase schema or environment variables.
- Mentor is a fictional in-game/simulated role. This is not human certification.
