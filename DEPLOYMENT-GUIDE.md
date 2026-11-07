# CALLORIA 0.7.0 — GUI deployment guide

Target GitHub repository: `zaksz1991/calloria`  
Target Vercel site: `calloria.vercel.app`  
Production branch: `main`

## 1. Replace the repository files

1. Download and extract `CALLORIA-v0.7.0.zip` in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop. If it is not on this computer, clone the existing repository through GitHub Desktop.
3. In GitHub Desktop, select **Repository → Show in Explorer**.
4. Copy the contents of the extracted `CALLORIA-v0.7.0` folder into the local repository root. Do not copy an outer wrapper folder and do not delete the hidden `.git` folder.
5. Allow File Explorer to replace matching files. New modules and test files should be added alongside the existing project files.
6. Return to GitHub Desktop and review the changed-file list. It should include the updated `js/main.js`, the new `js/multichannel-engine.js`, `styles.css`, navigation, documentation, package version and new tests. Existing engines and 3D workplace files remain included.
7. Use the summary `CALLORIA v0.7.0 — multi-channel customer operations`, commit to `main` and push the changes.

## 2. Vercel project settings

The repository includes the Vite deployment configuration. The existing Vercel project should use:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (22.12.0 minimum)

Keep the existing `calloria.vercel.app` domain attached to the same Vercel project. A push to the connected `main` branch should trigger a deployment. Deployment success must be confirmed in Vercel's deployment panel; it is not assumed by this package.

## 3. Post-deployment checks

1. Confirm the page title, icon and visible branding say CALLORIA and show Build 0.7.0.
2. Complete the recruitment-to-employment path or use an existing hired browser profile.
3. Visit People & Systems and confirm the 07:30 and 14:00 briefing windows use the in-game clock.
4. Start one shift for the simulated workday. Confirm a second shift cannot be started until the next workday is advanced.
5. Confirm inbound and outbound contacts cannot begin outside the 08:00–17:00 shift window.
6. Test the three scheduled breaks, return-from-break action, shift adherence and shift history.
7. Accept an inbound contact and test the optional customer-statement playback, typed-response fallback and consent checkbox.
8. On a supported browser, test microphone permission, a short sample recording and playback. Confirm that clearing the sample removes it from the page.
9. On a supported browser, test speech recognition. Confirm that the browser may use its own speech service and that transcript output is temporary.
10. Confirm the voice controls stop when a call is placed on hold, when navigating away from the inbound desk, when microphone consent is withdrawn and when the page is hidden.
11. Test call hold/resume, transfer, supervisor assistance, after-contact work, callback validation and customer opt-out suppression.
12. Accept one email, one live-chat and one social-media contact. Test channel filtering, reply validation, scripted customer follow-up, resolved/pending/escalated dispositions and CRM case linkage.
13. Confirm that attempted requests for PINs, passwords, one-time codes and full payment-card numbers are blocked. Test a public social response that directs account-specific help to a verified private channel.
14. Review digital channel metrics, CRM notes, workforce records and the operations timeline.
15. Re-test first-person navigation and mobile touch controls on actual Android and iPhone devices.

## 4. Verification boundary

Verification in the release preparation environment: 55/55 automated tests passed and all JavaScript syntax checks passed. `npm run build` could not run because Vite was not installed (`vite: not found`). A subsequent `npm install --no-audit --no-fund` attempt did not finish within 120 seconds. The production bundle is therefore unverified. Browser microphone permissions, speech recognition, external GLB loading, actual animation transitions and physical-device behaviour remain unverified. Vercel must complete the configured dependency installation and production build, then the deployment needs the post-deployment checks above.
