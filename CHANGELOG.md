# Changelog

## v6.52 — RuffNeck Platform Support Case Desk

- Added a synthetic support-case intake form to each selected RuffNeck service workspace.
- Added priority-based simulated response targets and automatic initial escalation for Critical cases.
- Added In Progress, Escalated and Resolved status updates with required evidence notes and a bounded case history.
- Copied platform-support cases into the existing local CRM case list and operations timeline.
- Added service, priority and SLA metadata to CRM case details.
- Shows `N/A` rather than a fabricated QA percentage for support-only cases.
- Redacts password/PIN/OTP-like strings, long numeric sequences, email addresses and phone numbers before notes are saved.
- Added responsive case-desk layout and 14 focused v6.52 tests.

## Included prior integrations

The cumulative overlay retains v6.42–v6.51 build plugins and their tests.
