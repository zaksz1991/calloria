# Changelog

## v5.9.0 — Finance Reconciliation & Period Close

- Added import of bank statement CSV files with signed amount or debit/credit columns.
- Added duplicate-row detection and statement batch history.
- Added read-only receipt summary import from Billing v5.8 local storage.
- Added exact-reference auto-match and ranked manual suggestions.
- Added one-to-one receipt matching with strict amount and currency equality.
- Added evidence-backed classification for bank fees, charges, tax/withholding, interest, transfers and other movements.
- Added documented statement-line exclusions.
- Added multi-currency credit/debit summaries and reconciliation exports.
- Added period close checklists, independent approval, approved-period import lock and controlled reopening.
- Added CSV formula-injection protection and responsive mobile layout.
- Added 60 focused engine and HTML-contract tests.

## Integration notes

- Reads `calloria.billing-operations.v58`; does not modify Billing v5.8 records.
- Stores its own data in `calloria.finance-reconciliation.v59`.
- No Vite configuration or existing application files are replaced.
