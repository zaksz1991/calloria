# CALLORIA 1.3.0 — Supabase setup and AI gateway

This release moves user identity and organisation administration to Supabase. Follow these steps before enabling cloud mode on the Vercel deployment.

## 1. Apply the database migration

1. Open the Supabase project used by CALLORIA.
2. Open **SQL Editor** and create a new query.
3. Copy the complete contents of `supabase/migrations/202611070001_calloria_server_tenancy.sql` into the editor.
4. Run the query once and confirm it completes without an error.
5. In **Table Editor**, confirm these tables exist: `profiles`, `organizations`, `organization_memberships`, `organization_invitations`, `organization_policies`, and `organization_audit`.
6. Open each table's RLS settings and confirm Row Level Security is enabled. The migration enables it explicitly.
7. In **Project Settings → API → Data API**, confirm `public` is an exposed schema so the browser SDK can call the permitted tables and RPC functions. The SQL grants and RLS policies still determine what each signed-in user may do.

Do not manually insert organisation owners or memberships. The `create_calloria_organization` database function creates the tenant, owner membership, policy row and initial audit event as one transaction.

## 2. Configure Supabase Auth

1. In **Authentication → Providers**, enable Email authentication.
2. Keep email confirmation enabled for real organisation use. Invitation acceptance checks the confirmed email address stored by Supabase Auth.
3. In **Authentication → URL Configuration**, set the Site URL to `https://calloria.vercel.app`.
4. Add the production URL and any Vercel preview URLs you use to the allowed redirect URL list.
5. Configure SMTP before sending invitations or password-reset messages at production scale. Supabase's default email service is intended for limited testing and may have delivery restrictions.

The CALLORIA invitation flow creates a pending database invitation; it does not send an email. Share the invitation email address and the CALLORIA sign-up URL through your approved process. The recipient must register with that exact email, confirm it and sign in before accepting the invitation.

## 3. Configure Vercel

Open the existing `calloria` project in Vercel. Under **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

A legacy `VITE_SUPABASE_ANON_KEY` is also accepted, but use the publishable key for a new setup. Apply the variables to Production and Preview environments as required, then trigger a fresh deployment so Vite includes them in the client bundle.

**Never create a `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_SECRET_KEY` or expose a service-role/secret key in browser code.** A Vite-prefixed variable is bundled for every site visitor. CALLORIA does not need a privileged key in the browser.

## 4. First-run workflow

1. Open the deployed CALLORIA site.
2. Create an account using an email address you control.
3. Confirm the Supabase email and sign in.
4. Create the first organisation workspace. The creator becomes its owner in the database.
5. Open **Organisation** and confirm the server-backed tenant banner, owner role, organisation ID, policy form and audit event.
6. Invite a second email address using a permitted role and a configured department.
7. Open a separate browser profile or private window. Register the invited address, confirm it and sign in.
8. Accept the invitation. Confirm the second account sees only its invited organisation.
9. Create a second organisation using another owner account. Confirm the first account cannot query or select that tenant unless it has a membership there.

## 5. Tenant-isolation checks required before production use

The package includes static source tests of the schema and client calls, but no live Supabase project is connected to this development environment. Those tests do not execute PostgreSQL or prove RLS behaviour. Perform these tests against the actual project:

- An unauthenticated visitor cannot select any tenant table or execute organisation RPCs.
- A user in Organisation A cannot select Organisation B, its memberships, profiles, invitations, policies or audit events by substituting a UUID.
- An agent cannot invite, suspend/reactivate staff, change policy or read audit events.
- A supervisor can read only the membership/operational data allowed by the policy map and cannot change a role or policy.
- A manager cannot execute member-management RPCs.
- An owner/admin can manage permitted tenant records but cannot assign or invite another owner through the invitation function.
- A user cannot accept an invitation sent to a different email address or before confirming the invited email.
- A suspended user loses access to organisation-scoped tables after the next database request, even if an old local save remains in the browser.
- An owner membership cannot be suspended through the member-status RPC.
- Expired and revoked invitations cannot be accepted. Expired pending records are marked expired when the invitation is retried or accepted.
- The browser bundle and Vercel environment contain no service-role or secret key.

Do not describe tenant isolation as production-verified until the full set has passed on the deployed Supabase project.

## 6. Data boundaries in this release

Server-backed: Supabase Auth account, profile name/email, organisation metadata, active membership, role, department, invitation status, tenant policies and administrative audit history.

Still browser-local: recruitment progress, employment/career progress, shifts, briefings, voice practice, synthetic inbound/outbound/digital conversations, CRM training cases, KPI history, and simulation state. Local saves are partitioned by Supabase user ID and selected organisation ID on that browser. Existing unscoped local/demo progress is not automatically imported into a cloud-scoped profile; the old browser save remains separate. Clearing browser storage or changing devices does not sync or restore this game progress.

This is an identity and tenant-administration milestone, not a complete cloud contact-centre operations platform.

## Official references

- [Supabase JavaScript client installation](https://supabase.com/docs/reference/javascript/installing)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)


## v1.0.0 migration

After applying `202611070001_calloria_server_tenancy.sql`, apply `202611070002_calloria_employment_persistence.sql`. This creates the tenant-scoped employment snapshot table and authenticated save RPC. No service-role key is required in the browser. Verify that the migration completes successfully before deploying the matching application build.


## v1.2.0 QA data behaviour

Human QA reviews, scorecard versions, disputes and calibration sessions are stored in the employee's existing `employment_snapshot` payload. No new SQL migration is required for this release. This is not a shared QA register: one employee snapshot is not a substitute for a tenant-wide QA schema or server-enforced reviewer permissions.


## 7. v1.3.0 AI assistance migration

1. In Supabase **SQL Editor**, create a new query.
2. Open `supabase/migrations/202611070003_calloria_ai_assistance.sql` from this package, copy the complete contents and run it after migrations 001 and 002.
3. In **Table Editor**, confirm `calloria_ai_settings` and `calloria_ai_usage` exist. Confirm RLS is enabled on both. `calloria_ai_usage` has no direct browser grants; its quota is changed through an authenticated security-definer function that checks active organisation membership and the tenant's enabled policy.
4. Confirm an initial disabled settings row exists for each existing organisation. New organisations created after this migration do not automatically get a settings row; the first owner/admin save creates it.
5. Do not enable the AI setting yet. Deploy the Edge Function and configure its secret first.

## 8. Deploy the AI Edge Function and secret

The new function is `supabase/functions/calloria-ai-assist/index.ts`. It validates the signed-in Supabase user, active organisation membership, tenant policy and atomic daily quota. It uses the server-side `OPENAI_API_KEY`; no provider key is required or permitted in Vercel client variables.

1. Open the Supabase project and go to **Edge Functions**.
2. Create a function named `calloria-ai-assist` using the dashboard's function editor/deployment flow. Use the complete `index.ts` source from this package. If the editor does not support importing `npm:@supabase/supabase-js@2`, deploy the same function through the Supabase CLI/CI flow supported by your project; do not replace the source with a browser-side OpenAI call.
3. Keep JWT verification enabled. The package includes `supabase/config.toml` with `verify_jwt = true`; the function also calls `auth.getUser()` and checks active membership itself.
4. In **Edge Functions → Secrets** (or the project's Edge Function secrets settings), add `OPENAI_API_KEY` with the secret from the organisation's authorised OpenAI API project. Never add it to Vercel, `.env.example`, `VITE_` variables, browser storage, GitHub source or client code.
5. Add `CALLORIA_ALLOWED_ORIGINS` containing the comma-separated exact CALLORIA origins, for example `https://calloria.vercel.app`. Add only the preview origins that should be allowed. The function fails closed when this setting is missing and rejects requests whose browser origin is not on the list; do not use `*`.
6. Confirm Supabase supplies `SUPABASE_URL` and a publishable/anon key to the Edge Function runtime. The code reads `SUPABASE_PUBLISHABLE_KEYS.default` or `SUPABASE_ANON_KEY`; it does not need a service-role key.
7. Deploy the function and verify its name is exactly `calloria-ai-assist`. Do not set `verify_jwt = false`.

## 9. Enable and test tenant AI policy

1. Sign in as an organisation owner/admin and open **Quality assurance**.
2. Confirm the AI panel loads the organisation's disabled default policy.
3. Enable the feature, choose `gpt-6-luna` or `gpt-6.1-terra`, set a daily limit between 1 and 5,000 and save.
4. Complete a synthetic Customer Lab interaction. In QA, select it, explicitly tick the transcript transfer consent and run one analysis.
5. Confirm an AI suggestion appears in the AI draft panel, and that the label says **Human approval required**.
6. Confirm it did not create an entry in the human QA review register, change a review, modify a promotion attempt or create an employee decision. A human reviewer must still complete the normal scorecard.
7. Confirm request usage increments for the organisation and the next allowed request count decreases. Test the configured quota with a small limit on a non-production test organisation.
8. Sign in as a user in a different organisation and confirm the AI settings and quota are not visible or mutable across tenants.
9. Sign in as an agent and confirm the agent cannot change tenant AI settings, even if the browser attempts a direct upsert.
10. Disable AI in the tenant policy and confirm the Edge Function rejects any further request for that organisation.

## 10. AI provider privacy and usage boundary

Only completed Customer Lab practice records are accepted by the interface and Edge Function. The request must carry the Customer Lab source marker, a completed `CIL-` interaction ID and one of the known synthetic persona, issue and channel identifiers. The AI-specific transcript contains both customer prompts and agent replies; the existing human QA evidence transcript remains unchanged. These client-generated identifiers are a source check, not cryptographic proof that transcript text was never edited or copied. CALLORIA redacts common credential-like strings, long numbers and email addresses before sending the transcript, and the Edge Function repeats redaction. Redaction is a precaution, not a guarantee that every sensitive value can be detected. Never paste or use real customer or employee records in Customer Lab or AI assistance.

The API request sets `store: false` and the Edge Function does not save prompt or response content into the CALLORIA usage table or log request bodies. This does not promise zero provider-side processing or retention. Review the provider's current terms, data controls, API account settings and the organisation's legal requirements before enabling it. Usage quota increments when a request is admitted, including requests where the provider subsequently fails.

The provided AI assistant is an advisory training aid. It may hallucinate, misclassify sentiment or miss a risk. Evidence is only visually marked verified when a suggested quote can be found in the redacted transcript; this is not proof that the model's conclusion is correct. Human review remains required.
