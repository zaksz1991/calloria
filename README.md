# CALLORIA Phase 6 — Secure Case Management and Staff Desk

Phase 6 completes the human-follow-up path that Phase 5 deliberately left as a limitation. It adds guest case submission, private customer status tracking, and a restricted staff queue for authorised employees.

## What this phase adds

### Customer-facing

- A support-case form from the Customer Care workbench.
- Optional customer name and optional email/phone follow-up details.
- Required, explicit storage consent before a case is saved.
- Sensitive identifiers and credentials are redacted from case descriptions.
- Case descriptions, names, and optional contact details are encrypted using AES-GCM before being written to Supabase.
- A random case reference and 256-bit access token are issued after successful submission.
- The raw access token is shown once, never stored in the database or browser storage, and is required with the reference to check status.
- Customers can view public status updates and a limited case timeline.
- No email, SMS, WhatsApp or external-platform message is sent automatically. Staff must use authorised channels.

### Staff-facing

- New `/case-desk` multi-page entry.
- Supabase email/password sign-in.
- Server-side access allowlist with supervisor and department-scoped agent roles.
- Customer case queue with status filters and search.
- Decrypted case details and optional contact details shown only to authorised staff.
- Department routing, assignment to self, and status changes.
- Customer-visible progress updates.
- Internal notes encrypted separately and shown only to authorised staff.
- Public event history is available to customers; private notes are excluded from customer status lookups.
- Database case events record the staff user ID responsible for an update.

## Files to integrate

Use the Phase 5 installation as the base. This is an additive package with complete replacements only for the listed files:

| Package file | CALLORIA repository destination | Action |
|---|---|---|
| `customer-care.html` | `customer-care.html` | Replace with Phase 6 version |
| `js/customer-care-workbench.js` | `js/customer-care-workbench.js` | Replace with Phase 6 version |
| `js/case-desk-engine.js` | `js/case-desk-engine.js` | Add |
| `case-desk.html` | `case-desk.html` | Add |
| `js/case-desk-workbench.js` | `js/case-desk-workbench.js` | Add |
| `styles/customer-care.css` | `styles/customer-care.css` | Replace with Phase 6 version |
| `styles/case-desk.css` | `styles/case-desk.css` | Add |
| `vite.config.js` | `vite.config.js` | Replace with Phase 6 version; preserves the Phase 5 Vite settings and adds the staff page entry |
| `supabase/functions/calloria-customer-care/index.ts` | same path | Replace with the updated intent classifier; preserves the Phase 5 retrieval and safety logic |
| `supabase/functions/calloria-case-desk/index.ts` | same path | Add |
| `supabase/migrations/202611070007_calloria_case_desk.sql` | `supabase/migrations/` | Add and apply once |
| `supabase/config.toml` | `supabase/config.toml` | Merge the new `calloria-case-desk` section; do not overwrite unrelated function settings |

Do not replace `index.html`, `main.js`, the 3D world files, `package.json`, or the Phase 5 knowledge files with this package. Existing Customer Care launch links and Phase 5 AI retrieval remain intact.

## Database migration

1. Check Supabase migration history before applying anything.
2. Migrations 001–004 are protected and must not be rerun.
3. Phase 5 migration 005 and 006 are prerequisites for the Phase 5 AI Customer Care retrieval endpoint. Apply them only if they have not already been applied.
4. Apply `202611070007_calloria_case_desk.sql` once.

The migration creates only `calloria_cc_*` tables, indexes and RPC functions. It does not alter Prospector tables, existing CALLORIA knowledge tables, profiles, organisations, authentication triggers or existing policies. The case tables have RLS enabled, no client policies, and no `anon` or `authenticated` privileges. Only the Edge Function's service role can read or write them.

## Supabase Edge Function

Deploy `calloria-case-desk` from `supabase/functions/calloria-case-desk/index.ts`.

Set this function's **Verify JWT** option to OFF. Guest users need to create cases and check status without registering. Staff access is separately verified inside the function against a signed-in Supabase user and the server-side department permission map. Turning off gateway JWT verification does not grant staff access and does not expose service-role credentials.

Keep these secrets in Supabase Edge Function Secrets, never in Vercel/browser variables:

- `CALLORIA_ALLOWED_ORIGINS` — exact allowed origins. Include `https://calloria.vercel.app` and only the local origins actually used.
- `CALLORIA_CASE_ENCRYPTION_SECRET` — a newly generated, high-entropy secret of at least 32 bytes. Generate it with a trusted password manager or secrets manager and store it only in Supabase secrets. Do not send it in chat, source files, GitHub or Vercel.
- `CALLORIA_CASE_RATE_LIMIT_SALT` — a separate high-entropy secret recommended for HMAC rate-limit fingerprints. When omitted, the function uses the Supabase service-role secret as the HMAC key.
- `CALLORIA_CASE_AGENT_ACCESS` — a JSON object mapping Supabase Auth user UUIDs to their role and department access.

Example structure for `CALLORIA_CASE_AGENT_ACCESS` (replace the placeholder IDs with actual user UUIDs from Supabase Authentication → Users):

```json
{
  "11111111-1111-4111-8111-111111111111": {
    "role": "supervisor",
    "departments": ["*"]
  },
  "22222222-2222-4222-8222-222222222222": {
    "role": "agent",
    "departments": ["RuffNeck Products and Platform Support", "Technical Support and IT"]
  }
}
```

A supervisor must have `departments: ["*"]`. An agent must have explicit department names. Supported department values are:

- `RuffNeck Products and Platform Support`
- `Sales and Service Enquiries`
- `Complaints and Service Recovery`
- `Personal Development and Wellbeing Information`
- `General Customer Care`
- `Email and Written Support`
- `Social Media Support`
- `Technical Support and IT`
- `Quality Assurance and Customer Experience`
- `Safeguarding and Trained Human Support`
- `Learning and Career Development`

All listed staff accounts must already exist in the shared Supabase Auth project. Do not expose public staff registration. Grant only the departments required for each employee. Supervisors can view and route all case departments; agents can only view and update cases in their configured departments. The staff console supports taking ownership of a case or leaving it unassigned. Cross-agent reassignment is not exposed in this phase.

Keep `CALLORIA_CASE_ENCRYPTION_SECRET` stable. Changing it without re-encrypting existing case details will make old case details and private notes unreadable. The raw customer tracking token cannot be recovered because only its SHA-256 hash is stored. A customer who loses it must submit a new case or contact support through an official channel.

## Vercel environment and routes

The staff and customer pages use the existing public variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not place the Groq key, Supabase service-role key, case encryption secret, or rate-limit salt in Vercel. The staff console uses the existing Supabase Auth project. The multi-page build adds `/case-desk` and preserves `/` and `/customer-care`.

## Data protection and operational limits

- Contact details, names, case subjects, descriptions and internal notes are encrypted at rest using AES-GCM. The Edge Function is the only component that decrypts them for authorised staff.
- Customer-provided phone numbers, emails, account/card numbers and credential patterns are redacted from case descriptions. Contact details intentionally entered in the separate contact field are encrypted, not redacted.
- Customers can only read a case with both the public reference and the random access token. The reference alone is not sufficient.
- Rate-limit records store HMAC hashes, short time buckets and counts, not raw IP addresses or enquiry text.
- Case data is inaccessible after its 180-day expiry. Expired rows are purged opportunistically as the case endpoint receives requests; this is not yet a guaranteed nightly deletion schedule. A scheduled database cleanup is a separate operational control before production rollout.
- Customer cases are not automatically emailed, texted, assigned to a named human or guaranteed a resolution time. Staff must review the queue and use separately authorised contact channels.
- The case desk does not process payments, refunds, change accounts, access private customer accounts, or contact customers on WhatsApp/social platforms automatically.
- Critical self-harm, violence, abuse or immediate-danger content is refused as a routine case and redirected to emergency/human assistance. The ticket desk is not a crisis-response service.
- All staff permitted by the configured access map can access decrypted details in their assigned departments. The initial model does not include field-level redaction or separate safeguarding case visibility beyond department scoping; keep safeguarding staff in a separately restricted department and avoid granting wildcard access unnecessarily.

## Deployment order

1. Merge the listed files into the current Phase 5 repository.
2. Apply migration 007 after checking migration history.
3. Configure the encryption secret and staff permission map in Supabase Edge Function Secrets.
4. Redeploy `calloria-customer-care` with the expanded life-guidance classifier. Keep its existing Phase 5 secrets and guest access setting.
5. Deploy `calloria-case-desk` and leave Verify JWT OFF for guest endpoints; staff routes remain protected by explicit server-side verification.
6. Add the function's new Verify JWT setting to Supabase `config.toml` without deleting other sections.
7. Rebuild and deploy the existing Vercel project.
8. Test a guest case, status lookup with correct and incorrect access tokens, a department-scoped agent login, a supervisor login, status updates, private notes and cross-department access denial.

