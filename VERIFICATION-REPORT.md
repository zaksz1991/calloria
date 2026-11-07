# CALLORIA v0.9.0 Verification Report

## Checks executed in the release-preparation environment

| Check | Result | Notes |
|---|---|---|
| `node --check` for application modules | Passed | Includes `main.js`, 3D world, operations, workforce, shift, voice, multichannel, local organisation, cloud security and cloud platform modules. |
| `npm run check` | Passed | All configured JavaScript syntax checks completed. |
| `npm test` | Passed: 71/71 | Node regression tests; includes cloud configuration, role-map and static SQL/migration assertions. |
| Privileged-key configuration checks | Passed | Tests reject `sb_secret_` values and a JWT whose decoded role claim is `service_role`; accepts a legacy anon-role JWT. |
| Password reset/recovery source checks | Passed | Checks reset request, recovery event and password update wiring. |
| ZIP integrity | Passed | Final release archive is checked with `ZipFile.testzip()` after packaging. |
| `npm install` | Not completed | Installation timed out in this environment. |
| Vite production build | Not verified | Vite is not installed because dependency installation timed out. |
| Live Supabase migration | Not performed | No project credentials or live database session were supplied. |
| Live RLS / tenant isolation | Not verified | SQL tests in this package are source-level assertions, not PostgreSQL integration tests. |
| Real authentication/email flow | Not performed | Requires a configured Supabase project and email provider. |
| Browser, WebGL and mobile device QA | Not performed | No deployed browser/device test was run. |
| GitHub push / Vercel deployment | Not performed | This ZIP does not imply any repository or production change. |

## Release contents

- Supabase Auth sign-up, sign-in, password reset, recovery and sign-out client flows.
- Server-side tenant schema for profiles, organisations, memberships, invitations, policies and audit events.
- RLS policies and database RPCs for tenant creation, invitation creation/acceptance/revocation, member status and policy updates.
- A browser access gate that blocks local demo fallback when cloud configuration is partial or a configured cloud connection fails.
- User-and-organisation-scoped local gameplay save keys.
- Setup instructions and a manual tenant-isolation checklist.

## Security and operational boundaries

- The supplied migration must be applied successfully before cloud mode is enabled.
- Client-side role checks control presentation only; the database functions and RLS policies are the intended enforcement layer.
- Recognised Supabase service-role JWT claims and `sb_secret_` key strings are rejected by browser configuration validation. This is not a substitute for keeping privileged keys out of all client build environments.
- Invitation creation records a pending invitation but does not send an email. The invitee must create/confirm an account with the invited address and accept it.
- Authentication and organisation administration are designed to be server-backed after migration/configuration. Recruitment, career progression, customer simulations, CRM training cases, briefings, shifts, coaching, voice data and gameplay progress remain local browser data.
- Retention is a stored policy setting; automatic deletion/retention jobs are not implemented.
- RLS and SQL security have not been validated against a live Supabase project. Do not describe tenant isolation as production-verified until the complete checklist has passed on the deployed project.

## Release status

**Package status:** source package prepared; syntax and Node regression checks passed.  
**Production status:** not build-verified, not browser-tested, not Supabase-verified and not deployed.
