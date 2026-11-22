# CALLORIA v7.30 — GUI Installation

**Repository:** `zaksz1991/calloria`  
**Branch:** `main`  
**Production site:** `https://calloria.vercel.app`  
**Release:** Workforce Intelligence Command Centre

## Important repository baseline

This ZIP is a cumulative v7.23–v7.30 overlay, not the full CALLORIA repository. The publicly readable `main/vite.config.js` checked while preparing this release shows the v7.23–v7.27 digital-workforce plugin chain, but does not yet register v7.28 or v7.29. Verify your local GitHub Desktop checkout rather than assuming that the earlier v7.28/v7.29 packages were pushed.

Source check: `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`

The v7.30 transform requires v7.29's marker, engine import and panel render call. The release chain must run in this order:

v7.23 supervisor → v7.24 performance → v7.25 coaching → v7.26 coaching outcomes → v7.27 sustainment checkpoints → v7.28 career evidence → v7.29 workforce intelligence → v7.30 command centre.

## 1. Back up and preserve the existing project

1. Make a backup copy of the current local `calloria` repository folder.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` directory. Do not delete or replace the repository.
5. Preserve `public/assets/`, all GLB models, local `.env` files, Vercel settings, Supabase settings and every unrelated project file.

## 2. Merge the release files

1. Extract `CALLORIA-v7.30-WORKFORCE-INTELLIGENCE-COMMAND-CENTRE.zip` in Windows File Explorer.
2. Open the extracted `CALLORIA-v7.30` folder.
3. Merge the included `build`, `js`, `styles`, `tests` and `docs` folders into the matching repository folders. Keep existing unrelated files.
4. Add `CHANGELOG-v7.30.md`, `README.md` and `INSTALL-GITHUB-v7.30.md` to the repository root.
5. The archive also carries forward the v7.23–v7.29 overlay files. Do not omit v7.28 or v7.29 if your local checkout does not already contain them.

## 3. Merge Vite plugin registrations carefully

The supplied `vite.config.js` carries forward the v7.28 and v7.29 registrations. Do not replace a more recent project-specific config wholesale. Keep the current config and merge the imports and function calls for every missing plugin.

If your local config is still at v7.27, add all three imports:

```js
import { calloriaDigitalCareerEvidencePluginV728 } from './build/calloria-digital-career-evidence-v728.mjs';
import { calloriaWorkforceIntelligencePluginV729 } from './build/calloria-workforce-intelligence-v729.mjs';
import { calloriaWorkforceCommandCentrePluginV730 } from './build/calloria-workforce-command-centre-v730.mjs';
```

In the `plugins` array, add the calls consecutively after the existing v7.27 call:

```js
calloriaDigitalCareerEvidencePluginV728(),
calloriaWorkforceIntelligencePluginV729(),
calloriaWorkforceCommandCentrePluginV730()
```

If your config already registers v7.28, add only the v7.29 and v7.30 import/call pairs that are missing. If it already registers v7.29, add only v7.30. Keep v7.30 after v7.29.

Do not add duplicate imports or plugin calls. Preserve all existing 3D, OJT, multichannel, mobile, Supabase and Vercel configuration.

## 4. Confirm required release files

- `js/workforce-command-centre-engine-v730.js`
- `build/calloria-workforce-command-centre-v730.mjs`
- `styles/calloria-workforce-command-centre-v730.css`
- `tests/workforce-command-centre-v730.test.mjs`
- `tests/vite-config-v730.test.mjs`
- `js/workforce-intelligence-engine-v729.js`
- `build/calloria-workforce-intelligence-v729.mjs`
- `js/digital-career-evidence-engine-v728.js`
- `build/calloria-digital-career-evidence-v728.mjs`

## 5. Supervisor acceptance checks

1. Use an employed profile and open **Supervisor**.
2. Scroll below **Workforce performance intelligence** to **Workforce intelligence command centre**.
3. Check the Voice row. It must be labelled as current local employee profile scope, not organisation-wide voice volume.
4. Check Email, Live Chat and Social separately. Missing channel-level cycles must not be fabricated.
5. Check department comparison. It should show actual group rows only when an exact employee-ID mapping or explicit department field is present. Otherwise, it must show the department mapping unavailable message.
6. Check the supervisor attention queue with a profile containing overdue, at-risk or low response-target records.
7. In the capacity planner, enter a planned seat count and the maximum open-items-per-seat assumption. Recalculate and check lower, baseline and surge backlog scenarios.
8. Confirm the planner labels its output as a backlog stress test, not an actual arrival forecast or staffing command.
9. Select **Export command-centre CSV** and confirm the file contains workstream, mapped department and flagged-agent summaries.
10. Confirm the command centre does not reassign work, change employee records, or make HR decisions.
11. Repeat at narrow phone width. Tables must scroll inside their own containers; page width must not overflow horizontally.

## 6. Configuration and data requirements

- No Supabase migration or Edge Function change.
- No new Vercel environment variable, secret or API key.
- No new npm dependency.
- For department comparisons, explicit fields can be supplied on digital performance agent rows (`departmentName`, `department`, `teamName`, `team`, or `departmentId`) or by exact ID in `state.workforceRoster`, `state.staff` or `state.employees`. `state.departments` can map department IDs to names.
- The current local employee is mapped only through `EMP-${state.nameInitials}` and the explicit `state.department` value.
- No department is inferred from an agent's name or service channel.
- Planned seats and open-items-per-seat are local session-only what-if inputs. They are not saved to Supabase or employee records.

## 7. Commit and deploy

1. Review the GitHub Desktop changed-file list. Confirm `.git`, `public/assets/`, GLB models, local environment files and unrelated project files remain untouched.
2. Commit with message `CALLORIA v7.30 — workforce intelligence command centre`.
3. Push to `main`.
4. Inspect the full Vercel deployment log. Treat the release as deployed only after Vercel reports a successful production deployment.

## 8. Verification boundary

- 107 automated tests passed; 0 failed.
- 34 JavaScript/MJS files passed Node syntax checks.
- Generated v7.23 → v7.30 transform syntax, safe skip, idempotency, department mapping, capacity calculations and CSV contracts were tested.
- A complete Vite production build was not run because this preparation workspace does not include the full application repository and installed project dependencies.
- GitHub push, live Vercel deployment, browser rendering against the full app and physical Android/iOS checks remain unverified.
