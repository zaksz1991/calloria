# Install CALLORIA v6.45 (GitHub GUI)

1. Download and extract `CALLORIA_v6_45_Inbound_QA_Review_Bridge.zip`.
2. Open the `zaksz1991/calloria` repository on GitHub and select the `main` branch.
3. Add the files from this overlay, preserving the `build/` and `tests/` folder paths.
4. Replace the repository's `vite.config.js` with the one in this overlay. It retains the existing plugin chain and registers v6.42, v6.43, v6.44 and v6.45 in the required order.
5. Commit the changes to `main` and allow Vercel to build the commit.

Do not upload or replace `package.json`, `package-lock.json`, `.env` files, Supabase credentials, Groq keys, or any GLB assets. The patch introduces no new package dependency or database migration.

## After deployment
- Complete an inbound contact and save its after-contact record.
- Open Quality Assurance → Human QA & calibration.
- Confirm the contact appears in **Inbound interaction review queue**.
- Select the interaction, complete each scorecard rating and attach transcript evidence before saving the human review.
- A contact with a recorded breach should be labelled **MANDATORY REVIEW**.

The review queue is local simulation data and follows the app's existing save/sync behaviour. It is not a server-enforced supervisor work queue.
