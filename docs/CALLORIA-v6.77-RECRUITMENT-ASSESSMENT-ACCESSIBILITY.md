# CALLORIA v6.77 — Recruitment assessment accessibility and viewport resilience

## Scope

This release continues the v6.75 assessment visibility and v6.76 progress/review work. It targets keyboard navigation, assistive-technology hints, predictable focus after question changes and short landscape mobile layouts.

## Candidate interaction

- Press `1`, `2` or `3` to select one of the current question's answer options. A fourth option, when present, is available with `4`; shortcuts never select an option that is not displayed.
- Use Tab to move to the Continue button or the mobile assessment dock. Press Enter or Space using the normal browser button interaction.
- Inputs, text areas, selects and editable text regions are excluded from the numeric shortcuts.
- Pointer/touch selection and keyboard selection use the same response handler and both save before the next screen is rendered.
- After moving to a new question or the final review, keyboard focus is placed on that heading.

## Small landscape screens

At coarse-pointer landscape sizes with a short viewport, the assessment dock now uses a full-width bottom bar. It no longer occupies the right side of the page where it could cover answer text. The progress sidebar is suppressed in this constrained view, the question card is compacted, and safe-area space is reserved below the answer list.

## Compatibility

Question wording, answer options, scoring weights, critical breach handling, pass threshold, result flow, retake behaviour and offer acceptance are unchanged. This is a frontend-only change; no Supabase migration or new secret is required.
