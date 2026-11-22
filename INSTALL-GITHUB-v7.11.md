# CALLORIA v7.11 — Installation

Release type: additive overlay, not a complete repository replacement.

## Files in this package

- `js/calloria-wrap-evidence-v711.js` — structured after-contact evidence renderer and validator.
- `build/calloria-after-contact-evidence-gate-v711.mjs` — Vite source integration.
- `tests/after-contact-evidence-v711.test.mjs` — focused regression tests.
- `VITE-CONFIG-ADDITIONS-v7.11.txt` — exact Vite registration.

## Install with GitHub Desktop and File Explorer

1. Make a backup copy of your current CALLORIA repository.
2. Extract this ZIP.
3. Open GitHub Desktop, select the CALLORIA repository, then choose **Repository → Show in Explorer**.
4. Copy the supplied `js`, `build` and `tests` files into the matching repository folders. Merge folders; do not delete existing files.
5. Open `vite.config.js` in your normal text editor.
6. Add the import and one plugin registration exactly as shown in `VITE-CONFIG-ADDITIONS-v7.11.txt`.
7. Keep all existing Vite plugin registrations and their order. Add v7.11 as the final entry.
8. Save, then review the changed files in GitHub Desktop.
9. Commit with: `CALLORIA v7.11 — after-contact evidence quality gate`.
10. Push to `main` and inspect the Vercel deployment log.

## Expected behaviour

The existing inbound and outbound after-contact form receives a required **Case outcome evidence** panel. It asks the agent to classify the issue, record the primary root cause, choose the action actually taken, record customer understanding, and confirm factual note handling.

The final disposition and structured evidence must agree. Examples:
- A resolved/completed interaction requires a resolution, guidance, troubleshooting or complaint action and confirmed customer understanding.
- A callback requires a callback-agreed action and confirmed understanding. Existing callback-commitment validation remains in force.
- An escalation/review requires a specialist/supervisor referral action.
- A no-answer, busy or voicemail attempt requires no-contact / customer-not-reached evidence.
- An opt-out requires the do-not-contact action.

Evidence is attached to the existing inbound/outbound case record. Outbound attempt records also receive the evidence object. The existing QA estimate, customer satisfaction calculation, salary, promotion logic, Supabase schema and gameplay state model are not changed.

## Important

The plugin deliberately fails with a clear source-rebase error if any required source anchor is missing or duplicated. It does not apply a partial transform. Do not add a second registration. Do not replace `main.js`, `index.html`, `package.json`, `vercel.json`, Supabase configuration or GLB assets.
