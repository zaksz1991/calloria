# CALLORIA v4.1.0 — Interactive OJT Shadowing

This upgrade deepens the employee onboarding journey. Recruitment remains the entry gate; after accepting employment, a new hire completes product/service knowledge, CRM logging practice, a guided agent-shadowing interaction and supervised practice before trainer sign-off and workstation allocation.

## What changes

The previous shadowing panel was primarily a five-stage read-and-click sequence. v4.1 replaces it with a continuous simulated contact that requires the trainee to advance through actual training actions:

1. Observe an offered inbound contact and accept/pick it from the queue.
2. Observe the experienced agent's approved greeting, preferred-name check and listening.
3. Complete a factual CRM training record with contact reason, action and next step.
4. Review the approved procedure and select a supported resolution, case or specialist-referral path.
5. Complete after-contact work with a disposition that must match the selected path and a factual wrap-up note.

The selected industry pack controls the example scenario. General customer experience remains the default; banking is optional, alongside telecommunications, retail, utilities, logistics, travel, insurance, non-clinical healthcare administration, technology and public-service information.

## Data and scoring boundary

All customer names and references in this module are synthetic training data. Training observations are saved under the onboarding profile only. They do not create production customer cases, increment calls handled, affect QA/CSAT/AHT, alter salary or count as official performance. Trainer sign-off remains required before desk allocation.

## Files

- Replace `build/calloria-ojt-runtime.js` with the complete file in this ZIP.
- Add `tests/calloria-v41-interactive-ojt-shadowing.test.mjs`.

Do not replace `build/calloria-ojt-glb-activation-plugin.mjs`, `vite.config.js`, `package.json`, `main.js`, `index.html`, GLB asset files or the workforce/operations engines. The existing v3.8.2 Vite plugin reads this OJT runtime file during its build, so no plugin anchor or Vite configuration change is needed.
