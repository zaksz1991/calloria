# v3.4 verification record

## Checks performed in this artifact workspace

- Node.js syntax check for `build/calloria-in-world-operations-v3-4-plugin.mjs`.
- Node unit tests for staff Draco transform, player pose guard, transform anchor failure, inbound routing, mobile tutorial sizing and HTML idempotency.
- Manual comparison of the supplied `vite.config.js` against the current public `main` branch configuration fetched on 10 November 2026. The original plugin list, build inputs, chunking and server/preview settings are retained; the v3.4 plugin is appended.

## Not performed

- No checkout of the complete current GitHub main branch was available in this workspace.
- No `npm install`, full `npm test` against the repository, or Vite production build was run against the actual project.
- No commit was pushed to GitHub and no Vercel deployment was initiated.
- No hosted GLB file was downloaded and decoded in a live browser.
- No Android/iOS visual, touch-control, frame-rate or memory test was performed.

## Release gate

Do not consider v3.4 verified or deployed until the full repository tests and Vercel production build pass, the runtime reports GLB staff loading correctly (or a specific actionable failure), and the Android gameplay flow is tested from shift briefing through an accepted inbound contact, CRM/case update, after-contact disposition and saved performance result.
