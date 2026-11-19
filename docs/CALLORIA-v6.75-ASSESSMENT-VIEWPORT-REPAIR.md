# CALLORIA v6.75 — Recruitment Assessment Visibility & Viewport Repair

## Problem addressed

The recruitment assessment was rendered below the contact-centre workplace preview while the application header and navigation remained visible. On short laptop and phone viewports, the question, answer choices and Continue action were spread across separate screen areas. The fixed mobile Continue dock could also cover the last answer choice before the candidate scrolled.

## Changes

- Added a dedicated candidate-flow viewport mode for aptitude questions, practical-call questions, recruitment results and the employment offer.
- The mode hides the 3D world preview, global header, sidebar and general application footer, and gives the assessment the available page width.
- Mobile layouts remove the duplicate page heading because the assessment card already identifies the recruitment stage. This makes room for the full answer list above the fixed Continue dock on a common 390 × 844 phone viewport.
- Reduced mobile assessment spacing while keeping answer controls readable and at least 56 px high in the phone-specific layout.
- Reused the existing v6.11 mobile assessment dock. It stays at the viewport edge, mirrors the original Continue label and disabled state, and triggers the original delegated `assessment-next` / `practical-next` action.
- Desktop retains the original footer as a sticky action row.
- Answer options are real buttons with group labels and `aria-pressed` selected state. The footer explains why Continue is disabled and confirms when an answer is selected.
- Advancing to another question/call stage scrolls the new question into view. Selecting an answer restores focus to that answer without jumping the page to the top.
- Returning to the 3D game clears the focused assessment mode before showing the world again.

## Recruitment rules preserved

The seven aptitude questions, three practical-call stages, answer values, critical security/contact-preference breach checks, existing pass threshold, retake action and employment offer flow remain unchanged. Recruitment remains the employment entry gate; this does not turn the product into a training-only experience.

## Files included

- `js/main.js` — complete updated application entry module.
- `public/calloria-mobile-responsive-v6-10.css` — complete updated mobile/responsive stylesheet, including its previous rules and the new v6.75 section.
- `tests/calloria-assessment-visibility-v675.test.mjs` — new assessment and viewport regression tests.
- `CHANGELOG.md` — updated project changelog.
- `docs/CALLORIA-v6.75-ASSESSMENT-VIEWPORT-REPAIR.md` — this release note.
- `INSTALL-GITHUB-v6.75.md` and `VERIFICATION-v6.75.md` — installation and verification records.

## Installation

Merge the archive contents into the root of the existing v6.74-integrated CALLORIA repository. Replace the two existing source files at their exact paths; add the new test and documentation files. Keep all other repository files, the `.git` directory, the `public/assets/` folder and all existing GLB models. Do not copy an outer wrapper folder into the repository.

No Supabase migration, secret, environment variable, dependency or 3D model change is required.
