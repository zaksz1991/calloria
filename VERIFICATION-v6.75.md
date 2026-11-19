# CALLORIA v6.75 — Verification report

## Source-level changes

- Assessment, practical-call, result and offer flows now enter a focused viewport mode that removes the 3D hero and global navigation from the candidate screen.
- Aptitude and practical choices are named button groups; selected choices expose `aria-pressed`. Continue remains disabled until a response is selected.
- Desktop uses its original action button in a sticky footer. Mobile reuses the installed v6.11 dock and proxies clicks to the original action handler rather than creating a second scoring/progression path.
- Leaving the assessment for the 3D world removes the assessment body class so the 3D scene is not hidden.
- The question bank, three practical call stages, scoring and pass/breach conditions were checked as unchanged.

## Automated checks

| Check | Result |
|---|---:|
| New v6.75 assessment regression tests | 5 passed |
| Combined focused assessment, mobile, workstation and workforce tests | 29 passed, 0 failed |
| Existing recruitment-gate compatibility tests | 2 passed |
| Total focused test executions | 31 passed, 0 failed |
| `npm run check` JavaScript syntax checks | Passed |
| CSS stylesheet parser | 0 parse errors |

## Browser viewport checks

A Chromium viewport harness used the actual project stylesheets and the existing v6.11 mobile assessment guard with representative aptitude markup. This is a responsive UI harness, not a complete Vite application end-to-end run.

- **390 × 844 phone:** all four answer choices fit in the first viewport; the last choice ends where the fixed dock begins, with no overlap. The Continue dock enabled after an answer was selected and its proxy click invoked the original `assessment-next` button.
- **320 × 568 phone:** scrolling the last answer into view placed it above the fixed dock with no overlap.
- **360 × 800 phone:** the last answer remained accessible above the dock after scroll.
- **844 × 390 landscape phone:** scrolling the last answer into view kept it clear of the dock.
- **1366 × 768 desktop:** the 3D preview, topbar and sidebar were hidden in assessment mode; the original Continue footer remained sticky and visible.

## Not verified

- Vite production build: not run because this source workspace has no installed `node_modules` / Vite package.
- Complete application browser end-to-end test: not run. The Chromium run exercised the live CSS and existing mobile guard against a representative page fixture.
- Physical Android/iOS device testing: not run.
- GitHub push and Vercel deployment: not performed or claimed.

## Compatibility boundary

The original recruitment assessment content, score calculation, critical breach rules, retake flow and employment offer acceptance are preserved. No database schema, Supabase function, secret, environment variable, dependency or public 3D asset is changed.
