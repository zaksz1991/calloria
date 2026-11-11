# CALLORIA v5.9 — Finance Reconciliation & Period Close

An additive browser module for bank-statement CSV import, receipt reconciliation against Billing v5.8, evidence-backed transaction classification, and two-person finance period close.

## Package contents

```text
CALLORIA_v5_9_Finance_Reconciliation/
├── public/
│   ├── finance-reconciliation.html
│   ├── finance-reconciliation.css
│   ├── finance-reconciliation.js
│   └── finance-reconciliation-engine.js
├── samples/
│   └── bank-statement-template.csv
├── tests/
│   ├── finance-reconciliation-v59.test.mjs
│   └── finance-reconciliation-html-v59.test.mjs
├── CHANGELOG.md
├── README.md
└── VERIFICATION.md
```

## Installation

Copy the four files in this package's `public/` directory into the existing CALLORIA repository's `public/` directory. Preserve all existing files.

Do not replace the existing `billing-operations.html`, `billing-operations.js` or `billing-operations-engine.js` files. v5.9 reads Billing v5.8 data without writing to or changing the v5.8 storage record.

With the existing Vite configuration using `publicDir: 'public'`, the expected page route after the files are deployed is:

`/finance-reconciliation.html`

Production URL after deployment:

`https://calloria.vercel.app/finance-reconciliation.html`

The route has not been verified on the live deployment.

## Using the module

1. Open Billing & Revenue Operations v5.8 on the same browser origin and ensure its records have been saved.
2. Open Finance Reconciliation v5.9 on that same origin and browser profile.
3. Select **Import v5.8 receipts**. This reads the `calloria.billing-operations.v58` local-storage record. It imports receipt summaries only.
4. Export a bank statement from the bank independently as CSV. Use the supplied CSV template or equivalent headers.
5. Choose the bank account, record the importing operator and import the statement file.
6. Use **Auto-match exact references** for unique reference + exact amount + exact currency matches.
7. Review amount/currency suggestions manually. Manual matching still requires exact amount and currency plus an evidence reason.
8. Classify fees, transfers, interest and other statement movements with a named operator and written evidence. Use exclusions only with a documented reason.
9. Prepare a period close, resolve every blocker, refresh the checklist, then obtain approval from a different person.

### CSV format

The importer accepts a transaction date and either a signed `amount` or separate `debit` and `credit` columns. Supported aliases include `transactionDate`, `bookingDate`, `valueDate`, `reference`, `bankReference`, `transactionReference`, `narration`, `details`, `currency`, `ccy`, `bankAccount`, `account` and `accountName`.

Currencies currently accepted: NGN, USD, GBP and EUR. Amounts use decimal notation; commas used as thousands separators are removed. Debit and credit values must not both be populated for the same row.

## Controls

- Automatic matching requires one unique receipt candidate with exact reference, amount and currency.
- Similar amount/date candidates are suggestions only; they are not automatically linked.
- Manual matching requires exact amount and currency, a named operator and a written reason.
- A Billing receipt cannot be matched to more than one bank statement line.
- Bank credits not represented in Billing may be classified, but must not be misrepresented as customer receipts.
- Every statement movement must be matched, classified or explicitly excluded before period close.
- Every Billing receipt in the period must have a bank statement match.
- Period approval is blocked by unresolved items and requires a different person from the preparer.
- Approved periods are locked against new statement imports in this browser workspace. Reopening requires a different person from the approver and a documented reason.
- CSV exports escape spreadsheet formula-leading values.

## Integration boundary and limitations

This is a browser-local demonstration module. Reconciliation records are stored under `calloria.finance-reconciliation.v59` in browser local storage. Billing v5.8 is read from `calloria.billing-operations.v58` on the same browser origin; it is not changed by this module.

There is no live bank feed, open-banking connection, bank-account verification, payment processing, accounting ledger, general-ledger posting, tax engine, payroll integration, invoice settlement, email delivery or multi-user database. A CSV statement is operator-supplied evidence, not proof that CALLORIA verified the bank source.

Net processor settlements, fee deductions from customer receipts, split deposits and partial bank matches are not supported. Amount/currency discrepancies remain unmatched and must be investigated outside this matching flow. This module does not calculate tax, recognize revenue under accounting standards or certify statutory financial statements.

Do not upload bank credentials, card data or confidential customer data. All sample values in the template are fictional.
