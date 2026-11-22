# CALLORIA v7.28 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release:** Workforce Career Evidence Bridge

## Release baseline

This is an additive overlay, not a complete CALLORIA repository replacement. It expects the v7.23–v7.27 digital follow-up modules to be merged first. During preparation, the public GitHub `main` Vite configuration was checked and still showed the v7.22 digital experience plugin as its final digital plugin; do not assume the v7.23–v7.27 chain is already present in that branch. If your local checkout already contains v7.27, proceed with the v7.28 additions below. Otherwise merge the v7.23, v7.24, v7.25, v7.26 and v7.27 overlays in order before v7.28.

## 1. Back up and open the existing repository

1. Make a backup copy of the current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` directory. Do not delete or replace the repository.
5. Preserve `public/assets/`, every existing GLB model, local environment files and all unrelated application files.

## 2. Merge the v7.28 files

1. Extract `CALLORIA-v7.28-DIGITAL-CAREER-EVIDENCE.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.28` folder.
3. Merge its `build`, `js`, `styles`, `tests` and `docs` folders into the matching folders in the existing repository. Keep all unrelated files.
4. Add `CHANGELOG-v7.28.md`, `README.md` and `INSTALL-GITHUB-v7.28.md` to the repository root.
5. Review `vite.config.js` before replacing it. The supplied configuration carries forward the v7.27 plugin sequence. Replace it only if the existing config matches that v7.27 baseline and contains no later project-specific change.
6. If the live config already contains v7.27 but has later changes, keep the live file and merge these additions:

   Import beside the v7.27 import:

   `import { calloriaDigitalCareerEvidencePluginV728 } from './build/calloria-digital-career-evidence-v728.mjs';`

   Add immediately after `calloriaDigitalFollowUpCoachingCheckpointsPluginV727()` in the `plugins` array:

   `calloriaDigitalCareerEvidencePluginV728(),`

7. Preserve plugin order: v7.23 supervisor → v7.24 performance → v7.25 coaching → v7.26 coaching outcomes → v7.27 sustainment checkpoints → v7.28 career evidence.
8. Confirm these new v7.28 files are present:
   - `js/digital-career-evidence-engine-v728.js`
   - `build/calloria-digital-career-evidence-v728.mjs`
   - `styles/calloria-digital-career-evidence-v728.css`
   - `tests/digital-career-evidence-v728.test.mjs`
   - `tests/vite-config-v728.test.mjs`
9. In GitHub Desktop, check that no unrelated files disappeared and that `.git`, `public/assets/` and GLB models are untouched.
10. Commit with message `CALLORIA v7.28 — workforce career evidence bridge`, then push to `main`.
11. Check the existing Vercel deployment. Treat v7.28 as deployed only after Vercel reports a successful production deployment.

## 3. Supervisor acceptance checks

1. Use a hired profile with at least one agent in the digital follow-up performance board.
2. Open **Supervisor** and scroll to **Workforce career evidence**.
3. Confirm each agent's completed-response sample, response-target rate, overdue count, at-risk count, active coaching and sustainment status are displayed.
4. Confirm fewer than 10 completed responses or a missing response-target rate is labelled insufficient evidence.
5. Confirm an agent with overdue work, excessive at-risk work, low response-target rate, active coaching, a negative outcome review or a regression is not marked eligible for career review.
6. For an eligible agent, select **Prepare career review packet**. Confirm the captured evidence appears with a supervisor decision form.
7. Try submitting without a decision, supervisor name or 20-character rationale; the form and engine must reject the incomplete review.
8. Record each decision type in separate test profiles: refer for formal exam eligibility review, defer, and not recommended.
9. Confirm the decision, supervisor and evidence notes appear in the panel and operations timeline.
10. Confirm a formal exam referral does not create a promotion attempt, change job title, salary or employment status. The existing promotion eligibility checks, annual exam and three-attempt limit remain the only formal path.
11. Test at phone width and confirm cards, fields and action buttons fit without horizontal scrolling.

## 4. Configuration and safety

- No Supabase migration or Edge Function deployment is required.
- No environment variables, API keys, secrets or package dependencies are added.
- The readiness dossier is scoped to retained synthetic digital follow-up activity (Email, Live Chat and Social); it is not a complete employee appraisal.
- A completed coaching plan requires a positive outcome review and positive recorded 30-day checkpoint before that plan can support career-review readiness.
- A career evidence referral is not a promotion decision and does not bypass the existing formal exam and attempt limits.

## 5. Verification boundary

The preparation workspace does not contain the complete CALLORIA application repository or its installed Vite dependencies. The 76-test source suite and 25-file JavaScript syntax checks passed, including the generated transformed-main syntax test. A full production Vite build, production browser session, live Vercel deployment and physical Android/iOS test were not run. Confirm these against the complete repository after merging.
