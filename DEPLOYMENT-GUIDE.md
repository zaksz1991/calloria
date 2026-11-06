# CALLORIA 0.4.0 — GUI deployment guide

Target GitHub repository: `zaksz1991/calloria`  
Target Vercel site: `calloria.vercel.app`  
Production branch: `main`

## 1. Replace the repository files with this release

1. Download and extract `CALLORIA-v0.4.0.zip` in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop. If it is not on this computer, clone it through GitHub Desktop first.
3. In GitHub Desktop, select **Repository → Show in Explorer**.
4. Copy the contents of the extracted `CALLORIA-v0.4.0` folder into the local repository root. Do not copy an outer wrapper folder and do not delete the hidden `.git` folder.
5. Allow File Explorer to replace matching files.
6. Confirm the new `js/operations-engine.js` and `tests/operations-engine.test.mjs` files are present. Keep the existing CALLORIA asset, Vite config and other application source files.
7. Return to GitHub Desktop and review the changed-file list. It should include `js/operations-engine.js`, updated `js/main.js`, `index.html`, `styles.css`, the added tests, package version and project documentation.
8. Use the commit summary `CALLORIA v0.4.0 — contact-centre operations engine`, select **Commit to main**, then **Push origin**.

## 2. Vercel project settings

The repository contains `vercel.json` with the build configuration. The connected Vercel project should use:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (22.12.0 minimum)

Keep the existing `calloria.vercel.app` domain attached to the same Vercel project. A push to `main` should trigger a deployment when the repository integration is active.

## 3. Post-deployment checks

1. Confirm the page title and visible branding say CALLORIA.
2. Complete the recruitment-to-employment path or use a browser save with an existing hired profile.
3. Start a shift and open Inbound.
4. Confirm the queue includes priorities and route groups.
5. Accept a contact; verify the queue count decreases.
6. Test hold and resume.
7. Request supervisor assistance and check the Supervisor view.
8. Test specialist transfer; verify wrap-up forces escalation.
9. Complete a normal contact and verify the disposition and notes are required.
10. Schedule a future callback; verify it cannot be queued before its due time.
11. Complete the payment-reminder scenario by recording the customer's opt-out; verify the contact appears in the suppression register and is blocked from another dial attempt.
12. Complete an outbound callback after it becomes due; verify its attempt history.
13. Review CRM notes and the interaction timeline.
14. Re-test mobile navigation and 3D touch controls on actual Android/iPhone devices.

## 4. Verification boundary

Eighteen automated tests pass in the preparation environment, including nine operations-engine and integration regression tests. JavaScript syntax checks pass. A Vite production bundle could not be run here: Vite was not installed, and dependency installation timed out while waiting on the package registry. Full browser rendering, remote 3D model loading and physical-device testing remain unverified. Vercel must complete the configured dependency installation and production build; deployment success is not assumed in advance.
