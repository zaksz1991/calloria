# CALLORIA v7.23 — GUI installation

Target repository: `zaksz1991/calloria`  
Target branch: `main`  
Production site: `https://calloria.vercel.app`

## What this release adds

Digital follow-up SLA supervision. The Supervisor workspace now shows customer follow-up messages that remain unanswered after an agent's first reply, separates due-soon and overdue cases, lets the supervisor open the assigned digital thread, and supports a deliberate, duplicate-protected supervisor escalation request.

## Install with GitHub Desktop and File Explorer

1. Back up the existing local `calloria` repository folder.
2. Extract `CALLORIA-v7.23-DIGITAL-FOLLOWUP-SUPERVISION.zip`.
3. In GitHub Desktop, open the existing `zaksz1991/calloria` repository and select **Repository → Show in Explorer**.
4. Copy the archive's `build`, `js`, `styles`, `tests` and `docs` folders into the existing repository root. Allow matching files to be replaced. The included `js/digital-response-cycle-engine-v721.js` is the v7.21 dependency used by the existing v7.22 suite and the new v7.23 supervisor engine; keep it in the `js` folder.
5. Replace the existing root `vite.config.js` with the complete `vite.config.js` supplied in this release. It retains the current public multi-page inputs and existing plugins, keeps v7.22 registered, and registers v7.23 immediately after it.
6. Preserve the hidden `.git` directory, `public/assets/`, all GLB models, all existing source folders, local environment files and any local-only changes. This is an additive source overlay, not a full copy of the entire repository.
7. In GitHub Desktop, review the changed-file list. Confirm the new files include:
   - `build/calloria-digital-followup-supervisor-v723.mjs`
   - `js/digital-followup-supervisor-engine-v723.js`
   - `js/digital-response-cycle-engine-v721.js` (shared v7.21 dependency)
   - `styles/calloria-digital-followup-supervisor-v723.css`
   - `tests/digital-followup-supervisor-v723.test.mjs`
   - `tests/vite-config-v723.test.mjs`
   - the replacement root `vite.config.js`
   - `docs/CHANGELOG-v7.23.md` and `docs/RELEASE-STATUS.txt`
8. Commit with message `CALLORIA v7.23 — digital follow-up SLA supervision` and push to `main`.
9. Treat the release as deployed only after the existing Vercel project reports a successful production deployment.

## No configuration changes

- No Supabase SQL migration.
- No Supabase Edge Function deployment.
- No new Vercel environment variable or secret.
- No new npm dependency.
- Keep the existing Vite build settings and Node version.

## Acceptance checks after deployment

1. Open CALLORIA with an existing employed profile and start a shift.
2. Open Digital support and accept a synthetic email, live-chat or social contact.
3. Record an agent reply and receive the scripted customer follow-up.
4. Advance the simulated shift clock until the follow-up cycle is due soon, then overdue. The follow-up clock starts from the latest customer message in that follow-up burst; the first-response SLA must remain unchanged.
5. Open Supervisor. Confirm due-soon and overdue follow-ups appear separately in **Digital follow-up SLA watch**.
6. Select **Open thread**. Confirm the correct customer thread opens in Digital support.
7. Return to Supervisor and select **Raise intervention** for an overdue item. Confirm one open request appears in the Supervisor escalation desk.
8. Confirm the intervention button is disabled for that contact while its supervisor request remains open.
9. Claim and resolve the request through the existing Supervisor escalation workflow, using evidence as required by that workflow.
10. Reply to the customer and confirm the follow-up alert disappears once the response cycle is answered.
11. Repeat at phone width. Confirm the alert actions stack and remain usable without horizontal overflow.

## Release verification boundary

The included focused test files cover the pure supervisor alert engine, stale-alert validation, the Vite transform, idempotency, safe source-drift skip and plugin registration order. They do not replace the complete repository test suite or production browser checks. A full Vite production build, live Vercel deployment and physical-device test must still be confirmed in the actual repository.
