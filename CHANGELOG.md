# CALLORIA v6.57 — Seamless Product-to-Support Handoff

## Public visitor journey

- Adds two product-aware actions to every guided discovery result: **Access / pricing** and **Product support**.
- Sends visitors to the existing support router with the matching RuffNeck product preselected.
- Prefills Sales & Service Enquiry or Product Support according to the selected action.
- Retains the existing official-site and Ask CALLORIA actions.

## Support-router handoff

- Adds a URL-prefill bridge to the existing `js/support-router-workbench.js` module.
- Accepts only product IDs found in the existing `PLATFORMS` registry.
- Accepts only the allowlisted sales, platform support, account access and technical support intents.
- Generates product-specific editable subjects and request summaries.
- Preserves language choice, explicit storage consent, submit controls, one-time access codes and request tracking.
- Never auto-submits the form.

## Experience and safety

- Adds responsive action wrapping for narrow screens and visible focus treatment.
- States that request details are prefilled for review and are not sent automatically.
- Does not collect new personal details, add tracking, modify storage, or change product/payment flows.
- No Supabase migration, API key or environment-variable change.
