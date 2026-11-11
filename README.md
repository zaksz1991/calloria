# CALLORIA v5.7 — Sales & Partnership Operations

An additive, browser-local pipeline module for customer-need-led cross-sell, service enquiries, renewal opportunities, sponsorship proposals, advertising enquiries and partnership leads.

## Included

- Opportunity register and dashboard for New, Qualified, Proposal, Negotiation, Won, Lost and Disqualified stages.
- RuffNeck service/product catalogue: LMS, Prospector, Connect, Social Hub, Kano Run and Kano Keke, alongside general service and commercial sponsorship/advertising opportunities.
- Customer 360 profile lookup and optional explicit note write-through.
- Completed-contact reference import from v5.5 as a local source option; no contact is automatically marketed to.
- Required customer-stated need, evidence of product fit, owner and dated next action.
- Explicit permission record and suitability gate before qualification.
- Qualification block when a linked customer profile is inactive or an unresolved complaint, recovery or urgent P1 case exists. A documented supervisor review can be recorded where the customer separately requested the discussion.
- Proposal drafting with terms and limitations/disclosures. Proposals stay drafts and are not dispatched.
- Discount above 20% requires a supervisor approval flag; maximum permitted demo discount is 50%.
- No assumed pricing: estimated value is optional and operator-entered. The page does not calculate real fees, campaign inventory, player counts or sponsorship reach.
- Follow-up scheduling and outcomes, with marketing follow-ups blocked unless the linked Customer 360 record already contains marketing consent.
- Customer-specific do-not-contact suppression and opportunity audit timeline.
- CSV export with formula-injection neutralisation.
- Responsive desktop/mobile layout.

## Installation

This is an overlay patch, not a full CALLORIA repository export. Copy these four files from the package's `public/` folder into the repository's existing `public/` folder:

- `sales-operations.html`
- `sales-operations.css`
- `sales-operations.js`
- `sales-operations-engine.js`

Preserve existing files and configuration. Existing v5.4 Customer 360 and v5.5 Agent Workbench files are optional integrations; they are not overwritten.

After the files are committed and deployed, open:

`https://calloria.vercel.app/sales-operations.html`

## Use

1. Refresh customer data to read profiles in `calloria.customer-journey.v54` and completed workbench contacts in `calloria.agent-workbench.v55`.
2. Create an opportunity linked to a profile or as an unlinked prospect. Record the real customer need, product fit, explicit permission, owner and a dated next action.
3. Use **Qualify opportunity** only after suitability confirmation. If an open complaint, recovery or urgent P1 record exists for the customer, resolve it first or document the supervisor's service-risk review.
4. Prepare proposals only after qualification. Terms, scope and limitations are mandatory. Proposal drafts are not automatically sent.
5. Schedule follow-ups only where the customer gave permission. A marketing follow-up requires marketing consent to already exist in the linked Customer 360 profile.
6. Record won deals only with evidence of customer acceptance. Losses and disqualifications require a reason.
7. Use **Do not contact** when a customer requests no further sales contact. This blocks new opportunities and future follow-ups in this module.
8. Explicitly sync a concise opportunity summary to Customer 360 notes only when appropriate.

## Metrics

- Active opportunity count includes New, Qualified, Proposal and Negotiation.
- Estimated pipeline is the sum of operator-entered estimates for active opportunities, using proposal estimate where present.
- Won estimate uses proposal estimate where present, otherwise the opportunity estimate.
- Conversion is Won divided by Won plus Lost. Disqualified deals are excluded.
- These values are demonstration pipeline estimates, not actual revenue, booked sales, audited forecasts or cash received.

## Data and integration boundaries

- Local data key: `calloria.sales-operations.v57`.
- Customer 360 read source: `calloria.customer-journey.v54`.
- Customer 360 note write-through occurs only after an explicit operator action.
- Agent Workbench source: `calloria.agent-workbench.v55`; completed contacts are read as potential source references, not automatically converted or contacted.
- No Supabase writes, central CRM, real payment, quote, contract, telephony, email/SMS dispatch, social messaging, ad inventory or external analytics are connected.
- Do not enter confidential customer, payment, authentication, health or other sensitive personal information into this browser-local demonstration module.
- Synthetic sample records appear on first launch and are marked SAMPLE.
