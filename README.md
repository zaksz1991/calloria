# CALLORIA v5.8 — Billing & Revenue Operations

Additive browser-local order-to-cash module for the CALLORIA commercial operations simulator.

## Included

- Customer order register for one-time and recurring services.
- Draft order creation with customer, product, amount, currency, frequency, effective dates, owner and payment terms.
- One-way import of won v5.7 sales opportunities into draft orders. Imported records require a separate approval and scope review before billing.
- Segregated order approval: the order owner cannot approve their own order; customer acceptance evidence and confirmed scope are mandatory.
- Recurring order activation, pause, resume, completion and cancellation controls.
- Draft invoice creation from approved/active orders, with period uniqueness for recurring invoices and duplicate prevention for one-time orders.
- Invoice issue/lock, due-date control and void restrictions. Issued invoices are not edited; corrections use approved credit notes.
- Verified receipt register with external reference de-duplication, independently recorded and verified by separate people.
- Receipt allocation with customer and currency matching, receipt-balance and invoice-balance controls. No foreign-exchange conversion is performed.
- Credit notes with separate preparer and approver, amount revalidation at approval and application to outstanding invoice balance.
- Invoice disputes that pause creation of collection tasks until documented resolution.
- Internal-only collection tasks; they do not send reminders or customer messages.
- Refund request, independent approval and separate settlement recording. A refund must identify the payment allocation and settlement reverses only that allocation in the local ledger.
- Multi-currency dashboard totals by currency rather than adding unlike currencies; receivables aging and control queue.
- CSV exports for orders, invoices, receipts, financial controls and activity, with spreadsheet formula neutralisation.
- Responsive desktop/mobile layout.

## Installation

This is an overlay patch, not a complete CALLORIA repository export. Copy these four files from the package's `public/` folder into the repository's existing `public/` folder:

- `billing-operations.html`
- `billing-operations.css`
- `billing-operations.js`
- `billing-operations-engine.js`

Preserve existing files and configuration. The module is standalone; v5.7 Sales Operations and v5.4 Customer 360 are optional local-storage read sources.

After the files are committed and deployed, open:

`https://calloria.vercel.app/billing-operations.html`

## Workflow

1. Create an order directly or import won v5.7 opportunities. Imports produce draft orders, not approved orders.
2. Have a different staff member approve the order using customer acceptance evidence and confirmed scope.
3. Create an invoice draft from an approved or active order. Recurring invoices require a period end and cannot be duplicated for the same order/period.
4. Review and issue the invoice. The issued record is locked. Use a credit note for a correction rather than changing an issued invoice.
5. Record a receipt only after an external bank/processor receipt has been independently verified. Receipt recorder and verifier must be different people.
6. Allocate receipts to invoices with matching customer references and currency. Over-allocation and overpayment are blocked.
7. Use disputes to pause new collection actions during a billing investigation. Collections are internal tasks only.
8. Credit notes and refunds require segregation of duties. Refund settlement is recorded only after an external transfer has been completed and evidenced; CALLORIA does not move funds.

## Data and integration boundaries

- Local data key: `calloria.billing-operations.v58`.
- Optional won sales source: `calloria.sales-operations.v57`.
- Optional customer profile snapshot source: `calloria.customer-journey.v54`.
- Sales import reads won deals and creates local draft orders only. It does not change the source sales records.
- Customer refresh reads a summary count only. It does not alter Customer 360 records.
- No Supabase, central CRM, accounting ledger, tax calculation, payment gateway, bank feed, FX service, email/SMS dispatch or external invoice delivery is connected.
- Tax amounts are entered by an operator; the module does not calculate tax or establish legal tax treatment.
- Dashboard figures represent records in this browser only, not audited revenue, cash receipts, statutory accounts or consolidated financial statements.
- Do not enter card numbers, bank credentials, authentication secrets or confidential financial/customer information into this demonstration module. All first-launch sample records are synthetic and marked `demo` in the stored data.
