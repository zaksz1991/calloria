# CALLORIA v6.57 — Seamless Product-to-Support Handoff

CALLORIA serves three connected public journeys: **entertainment**, **education**, and **RuffNeck product discovery**. v6.57 improves the final part of that journey: when a visitor finds a product they want, they can move directly from discovery to the correct formal enquiry or support route without searching for the support form again.

## What visitors can do

Each RuffNeck product recommendation now has four clear next actions:

- **Open official destination:** visit the product's own website in a new tab.
- **Ask CALLORIA:** keep exploring through the existing customer-care assistant.
- **Access / pricing:** open the existing support router with the selected product and Sales & Service Enquiry intent already selected.
- **Product support:** open the same support router with the product and Product Support intent already selected.

The six destinations are RuffNeck Learn, Prospector, Connect, Social Hub, Kano Run / Kano Life and Kano Keke.

## What is prefilled

The support form receives only a validated product ID and an allowlisted support intent in the URL. It then prepares a product-specific subject and plain-language request summary. The visitor can change the product, category, language, subject and description before submitting.

**Nothing is submitted automatically.** The visitor must review the request, provide the form's required storage consent and press Submit. The existing support-routing, request reference and private access-code flow remain in control. No name, email or phone number is added by this handoff.

## Why this matters

The public path is now more direct:

1. Play or explore CALLORIA as a guest.
2. Learn and ask questions without committing to a product.
3. Compare relevant RuffNeck destinations.
4. Open the official product or request access/pricing information.
5. Existing users can go straight to product support.

This is a navigation and workflow improvement. It does not add invented prices, subscriptions, checkout, payment processing, live-agent availability or guaranteed response times.

## Boundaries

- No database migration or Supabase setting change.
- No API key, Groq setting or product credential change.
- No browser storage, tracking or new personal-data collection.
- Existing storage consent and support request submission requirements are preserved.
- Official product account creation, product access, prices and payments remain on the owning product site.

## Package contents

This cumulative upgrade overlay includes the v6.42–v6.57 build modules and tests present in this release chain, plus the replacement root `vite.config.js`. It is an overlay for the current CALLORIA repository, not a complete copy of every application source file or public asset.
