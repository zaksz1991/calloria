# CALLORIA 1.3.0 — GUI deployment guide

Target repository: `zaksz1991/calloria`  
Target Vercel site: `https://calloria.vercel.app`  
Production branch: `main`

## 1. Replace the repository files

1. Download and extract `CALLORIA-v1.3.0.zip` in Windows File Explorer.
2. Open the existing `zaksz1991/calloria` repository in GitHub Desktop. If it is not on this computer, clone the existing repository using GitHub Desktop.
3. In GitHub Desktop, choose **Repository → Show in Explorer**.
4. Copy the contents of the extracted `CALLORIA-v1.3.0` folder into the existing repository root. Do not copy an outer wrapper folder and do not delete the hidden `.git` folder.
5. Allow File Explorer to replace matching files and add the new cloud modules, tests and Supabase migration folder.
6. Review the changed-file list in GitHub Desktop. The release should include the updated `package.json`, `index.html`, `js/main.js`, `js/ai-assist-engine.js`, `js/customer-intelligence-engine.js`, `supabase/migrations/202611070003_calloria_ai_assistance.sql`, `supabase/functions/calloria-ai-assist/index.ts`, `supabase/config.toml`, and updated documentation/tests.
7. Use the summary `CALLORIA v1.3.0 — AI-assisted customer intelligence`, commit to `main` and push.

## 2. Apply Supabase setup before adding Vercel variables

Follow `SUPABASE-SETUP.md` in full. Apply `supabase/migrations/202611070001_calloria_server_tenancy.sql` in Supabase SQL Editor. Configure Email Auth and allowed redirect URLs. Confirm the six tenant tables exist and have RLS enabled.

Do not configure the Vercel cloud variables until the migration has been applied. With a configured Supabase URL/key but a missing database schema, CALLORIA intentionally blocks access rather than silently switching to local mode.

## 3. Vercel project settings

In the existing Vercel project:

- Framework preset: Vite
- Root directory: `./`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22.x or later (22.12.0 minimum)

Under **Settings → Environment Variables**, add:

- `VITE_SUPABASE_URL` — Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (preferred)

`VITE_SUPABASE_ANON_KEY` is accepted for projects still using the legacy anon key. Do not add a service-role or secret key to any `VITE_` variable. Vite embeds client variables in the public site bundle.

Apply variables to the correct Production and Preview scopes, save and trigger a new deployment. Keep `calloria.vercel.app` attached to this same Vercel project.

## 4. First deployment checks

1. Confirm CALLORIA branding and Build 1.3.0 are visible.
2. Confirm the sign-in/create-account gate appears when cloud variables are configured.
3. Create an account, confirm the email and sign in.
4. Create the first organisation; confirm the user becomes owner.
5. Change an organisation policy and confirm a server audit event is recorded.
6. Create a staff invitation. Confirm the interface explicitly says no email was sent.
7. Accept the invitation from a second confirmed account using the invited email.
8. Confirm that the invited account sees only its organisation membership.
9. Test owner/admin, manager, supervisor, QA, agent and trainee permissions.
10. Run every case in `supabase/tests/tenant-isolation-checklist.md` and record evidence.
11. Confirm local game saves are separate when switching accounts and organisation tenants in the same browser.
12. Confirm that clearing browser storage removes local simulation progress but does not remove Supabase identity or organisation records.
13. Re-test recruitment, voice, inbound/outbound, digital support, workforce, mobile controls and 3D workplace behaviour.

## 5. Verification boundary

Automated Node regression tests and JavaScript syntax checks are included in this release. The SQL migration was reviewed and statically tested through source-level checks, but it has not been executed against a live PostgreSQL/Supabase project in the release environment. Live RLS isolation, authentication emails, invitation acceptance, production build, deployment, browser rendering and physical Android/iOS behaviour remain unverified until the checks above are completed.

No GitHub commit, Vercel deployment, Supabase migration execution or live tenant-isolation result is implied by this ZIP package.


## v1.0.0 database release order
1. In Supabase SQL Editor, apply `202611070002_calloria_employment_persistence.sql` after the existing tenancy migration.
2. Confirm the `calloria_employment_records` table and `save_calloria_employment_snapshot` function exist.
3. Deploy this application build with the existing public Supabase URL and publishable/anon key environment variables. Do not expose a service-role or secret key.
4. Sign in with a test account, enter an organisation, complete or modify a harmless synthetic training action, reload, and confirm the progress is restored.
5. Sign in as a second organisation member and confirm the employee cannot read another member's private snapshot unless the role has operations-read permission. Test separate organisations with separate test accounts.


## 6. Apply v1.3 AI assistance setup before enabling the feature

1. Follow sections 7–10 of `SUPABASE-SETUP.md`. Apply migration `202611070003_calloria_ai_assistance.sql` after migrations 001 and 002.
2. Deploy the `calloria-ai-assist` Supabase Edge Function from `supabase/functions/calloria-ai-assist/index.ts`. Keep JWT verification on.
3. Add `OPENAI_API_KEY` to Supabase Edge Function secrets, not Vercel. Add `CALLORIA_ALLOWED_ORIGINS` with the exact production origin.
4. Confirm the Edge Function deployment is healthy and a signed-in owner/admin can load the tenant AI settings panel.
5. Only then enable the feature for a test organisation. Run an explicit-consent synthetic interaction analysis and confirm that it appears only as an advisory draft.
6. Confirm that no AI result is inserted into the Human QA register until a human completes the normal review form.
7. Test an agent role and a second organisation. Direct setting updates must be denied by PostgreSQL RLS and usage quota must remain tenant-scoped.

Do not add the OpenAI API key to Vercel or to any `VITE_` environment variable. The app's browser bundle must contain only the Supabase URL and publishable/anon key.


## v1.3.1 email registration hotfix

This release changes client-side email normalisation and registration error presentation only. It adds no SQL migration. Do not rerun migrations 001, 002 or 003 when deploying this hotfix. A fresh Vercel deployment is required for the updated browser bundle to take effect.
