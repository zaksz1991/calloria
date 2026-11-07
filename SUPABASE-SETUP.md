# CALLORIA 1.2.0 — Supabase setup

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
