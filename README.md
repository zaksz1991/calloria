# CALLORIA Phase 7 — Customer 360 CRM and Consent-Governed Portfolio Desk

**Build date:** 7 November 2026  
**Target baseline:** CALLORIA Phase 6 package (Phases 4–6 integrated)  
**Migration:** `202611070008_calloria_customer_360.sql`  
**New Edge Function:** `calloria-customer-360`  
**New staff page:** `/customer-360`

## Purpose

Phase 7 adds a restricted Customer 360 workspace for the agents supporting RuffNeck Entertainment products and services. It gives authorised employees a minimal customer profile, masked contact information, a consent ledger, linked identity references, a service interaction timeline, and a consent-controlled portfolio recommendation view.

It is a CRM foundation. It does **not** claim that CALLORIA is already synchronised with the account databases or internal APIs of RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run or Kano Keke.

## Included capabilities

- Staff sign-in through the existing Supabase Auth project; no public CRM registration.
- A separate server-side `CALLORIA_CRM_AGENT_ACCESS` permission map with supervisor/agent roles and department scoping.
- Customer lookup by exact email, exact phone, or name tokens. Blind indexes are HMAC-SHA256; the browser never receives raw contact details.
- New customer records require an email or phone and explicit service-contact consent. Marketing and AI-personalisation choices are stored separately and default to `not_granted` unless the customer explicitly opts in.
- Name, email and phone payloads are encrypted at rest by the Edge Function using AES-256-GCM with a derived key. No encryption or HMAC secret is sent to the browser.
- Contact search results expose masked email and phone only.
- Interaction timeline for voice, email, live chat, social, WhatsApp, website, portal, in-person and game support. Interaction notes are encrypted.
- Optional CALLORIA case reference on an interaction. This is a reference only; staff still open Case Desk to review the underlying case.
- Personal-guidance events store a generic marker only. Relationship details, emotional disclosures, diagnostic details and other sensitive narratives are deliberately not retained in CRM.
- Consent changes are appended to the consent history and require explicit customer confirmation.
- Identity linking is supervisor-only. Newly linked email, phone, platform-account and guest-profile references begin unverified. A supervisor can record an independent verification decision; only a hash of the non-sensitive evidence reference is stored.
- Erasure of a CRM record is supervisor-only, requires a documented customer erasure reference, and cascades to CRM interactions, identities and consent rows. A non-sensitive audit event remains. Case Desk records are separate and follow their own retention rules.
- Product recommendations distinguish customer-requested information from proactive cross-selling. Proactive recommendations require explicit marketing consent and are suppressed for 30 days after a personal-guidance interaction.
- The portfolio includes RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run / Kano Life and Kano Keke.

## Important operational boundaries

1. **No automatic account access.** Staff cannot use this CRM to sign in as a customer, change a customer's account, make payments, issue refunds, connect social accounts or modify games/platform data.
2. **No direct platform integrations in this phase.** The six platforms are represented in a high-level catalogue and recommendation view. Product availability, account status, prices, API support, service levels and commercial terms must be checked with the owning product team or the official platform before being promised.
3. **No AI inference over CRM profiles in this phase.** Phase 7 uses deterministic portfolio rules. The `ai_personalization` consent field is a forward-looking governance control and does not mean CRM data is currently sent to Groq or another model.
4. **No marketing by default.** A customer asking for product information may receive the requested information without opting into marketing. Proactive cross-selling remains disabled unless marketing consent is explicitly granted.
5. **No cross-selling from a personal-guidance interaction.** Proactive commercial recommendations are suppressed for 30 days following a recorded personal-guidance interaction. The guidance content itself is not stored.
6. **Identity is not inferred.** A name, caller ID, shared device or unverified email/phone claim is not proof that a customer controls an account. Only the documented verification process can change an identity from unverified to verified.
7. **No automatic CRM retention purge.** Supervisors can erase a CRM contact on a documented customer request. A scheduled retention/expiry policy and operational review cadence must be configured before production launch. Case Desk retention is managed separately.
8. **No external messaging.** The CRM does not automatically send email, SMS, WhatsApp or social-media messages.

## Overlay / integration files

Use the Phase 6 source package as the base. Copy these files into the repository:

| Package path | Repository path | Action |
|---|---|---|
| `customer-360.html` | `customer-360.html` | Add |
| `case-desk.html` | `case-desk.html` | Replace with version containing Customer 360 navigation link |
| `js/customer-360-engine.js` | `js/customer-360-engine.js` | Add |
| `js/customer-360-workbench.js` | `js/customer-360-workbench.js` | Add |
| `styles/customer-360.css` | `styles/customer-360.css` | Add |
| `assets/ruffneck-catalog.json` | `assets/ruffneck-catalog.json` | Add reference catalogue snapshot |
| `vite.config.js` | `vite.config.js` | Replace only when using the supplied Phase 6 baseline; adds the Customer 360 page entry |
| `supabase/functions/calloria-customer-360/index.ts` | same path | Add and deploy |
| `supabase/migrations/202611070008_calloria_customer_360.sql` | `supabase/migrations/` | Add and apply once |
| `supabase/config.toml` | `supabase/config.toml` | Merge the new function entry; preserve unrelated settings |
| `tests/customer-360-engine.test.mjs` | `tests/` | Add |

Do not overwrite `index.html`, `main.js`, `production-world.js`, the Phase 5 knowledge modules, the Phase 6 case engine, or the existing package dependencies. Keep any later changes in your current Vite configuration; the supplied file is based on the Phase 6 three-page configuration only.

The repository currently sets `cleanUrls: true` in `vercel.json`, so the built `customer-360.html` page is intended to be served at `/customer-360` after the new Vite input is integrated.

## Database migration

- Confirm that migrations `202611070005`, `202611070006` and `202611070007` are already applied from the preceding phases.
- Apply `202611070008_calloria_customer_360.sql` **once**.
- Do not rerun migrations 001–007.
- The migration creates only `calloria_crm_*` tables, indexes and grants. It does not alter Prospector tables, shared profile/auth tables, other CALLORIA knowledge tables, case-desk tables, triggers or existing policies.
- All five CRM tables have RLS enabled. Direct privileges are revoked from `public`, `anon` and `authenticated`; the browser cannot access CRM tables directly. The Edge Function uses the service role after authenticating and authorising a staff user.
- Interaction, consent and audit records are insert-only for the service role. Identity rows permit update only for the supervisor verification decision. Contact rows permit update/delete for profile activity and the supervisor erasure action.

## Supabase Edge Function settings

Deploy `supabase/functions/calloria-customer-360/index.ts` as `calloria-customer-360`.

Set the function's `verify_jwt` to **OFF** because this function handles its own CORS preflight and validates the Supabase user token inside the handler with `admin.auth.getUser(token)`. This is not a public endpoint: every non-preflight action requires a valid signed-in user UUID present in `CALLORIA_CRM_AGENT_ACCESS`. Do not remove the in-function token check or allow unlisted users.

Add these secrets under **Supabase → Edge Functions → Secrets**:

- `CALLORIA_ALLOWED_ORIGINS` — comma-separated exact permitted origins, including `https://calloria.vercel.app` and only the local development origins actually used.
- `CALLORIA_CRM_ENCRYPTION_SECRET` — new high-entropy secret, at least 32 bytes. Keep it stable; rotating it without re-encrypting the records will make old contact/interaction data unreadable.
- `CALLORIA_CRM_IDENTITY_HMAC_SECRET` — a different new high-entropy secret, at least 32 bytes. Keep it stable; changing it will break blind-index search for existing records.
- `CALLORIA_CRM_AGENT_ACCESS` — JSON mapping existing Supabase Auth user UUIDs to roles and departments.

The Edge Function also uses the platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key, encryption secret and HMAC secret out of Vercel browser variables, source files, chat and GitHub.

Example `CALLORIA_CRM_AGENT_ACCESS` structure (replace the IDs with actual staff UUIDs from Supabase Authentication → Users):

```json
{
  "11111111-1111-4111-8111-111111111111": {
    "role": "supervisor",
    "departments": ["*"]
  },
  "22222222-2222-4222-8222-222222222222": {
    "role": "agent",
    "departments": ["RuffNeck Products and Platform Support"]
  },
  "33333333-3333-4333-8333-333333333333": {
    "role": "agent",
    "departments": ["Sales and Service Enquiries", "General Customer Care"]
  }
}
```

Supported departments are the exact values already used by Phase 6: RuffNeck Products and Platform Support; Sales and Service Enquiries; Complaints and Service Recovery; Personal Development and Wellbeing Information; General Customer Care; Email and Written Support; Social Media Support; Technical Support and IT; Quality Assurance and Customer Experience; Safeguarding and Trained Human Support; Learning and Career Development.

Keep this map separate from `CALLORIA_CASE_AGENT_ACCESS`. That prevents an agent's Case Desk access from automatically granting access to CRM identity and contact data. Grant only the minimum required department permissions. A supervisor must use `departments: ["*"]`.

## Browser environment

Use only the existing public Supabase settings in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not put `CALLORIA_CRM_ENCRYPTION_SECRET`, `CALLORIA_CRM_IDENTITY_HMAC_SECRET`, `CALLORIA_CRM_AGENT_ACCESS` or the service-role key in Vercel.

## Recommended rollout

1. Integrate the Phase 7 files into the Phase 6 baseline and merge Vite/Supabase config entries.
2. Apply migration 008 after checking Supabase migration history.
3. Add the three new CRM secrets and a narrowly scoped CRM staff permission map.
4. Deploy `calloria-customer-360` and verify that an unauthorised user receives 401/403, an authorised staff member can use `whoami`, and a staff account outside the allowlist is denied.
5. Build and test the Vite app; open `/customer-360` and `/case-desk` from the deployed preview.
6. Test contact creation, exact search, name search, consent updates, interaction logging, personal-guidance redaction, identity linking/verification, proactive recommendation suppression and CRM erasure with synthetic data only.
7. Confirm database backups, encryption-secret custody, staff offboarding, consent handling and retention before entering live customer information.

## Verification status

See `VERIFICATION.md`. This package is an integration overlay. It has not been pushed to GitHub, deployed to Supabase or Vercel, or connected to live product account APIs.
