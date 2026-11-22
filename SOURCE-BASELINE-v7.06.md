# CALLORIA v7.06 source baseline

## Observed deployment source

- Repository: `github.com/zaksz1991/calloria`
- Build log commit: `312a171`
- Vercel configuration: `cleanUrls: true`, output directory `dist`, build command `npm run build`.
- Vite configuration: `publicDir: 'public'`, multi-page entries, output directory `dist`.
- `support-router.html` footer links to `/privacy.html`.
- Neither repository-root `privacy.html` nor `public/privacy.html` exists at baseline commit `312a171`.
- The v7.05 navigation audit searches root and `public/` for static route targets, and correctly fails on the missing privacy route.

## Data-flow source references inspected

- `js/main.js` stores the local simulator save under `calloria.save.v1` using browser `localStorage`, and schedules cloud employment saves.
- `customer-care.html` explains that the AI Customer Care enquiry is not persisted in CALLORIA's own database or browser storage, that redacted text is sent to Groq, and that Groq may retain input/output for up to 30 days unless Zero Data Retention is enabled.
- `supabase/functions/calloria-contact-routing/index.ts` requires explicit consent for formal support request storage, redacts message fields, encrypts the request summary with AES-GCM, stores an access-token hash, uses an HMAC fingerprint for rate limiting and calls a closed-request purge routine.
- `supabase/functions/calloria-ai-assist/index.ts` limits the organisation AI-assist endpoint to synthetic Customer Lab interactions, enforces transcript redaction and requires organisation-level enablement and human approval.

This baseline was used to write the privacy notice conservatively. No retention period for all account, employment or CRM records and no deployment-level Groq Zero Data Retention setting was asserted.
