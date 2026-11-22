# Source baseline — CALLORIA v7.20

Inspection date: 22 November 2026.

Baseline: public `main` branch of `github.com/zaksz1991/calloria`.

## Files inspected

- `package.json`
- `vite.config.js`
- `js/main.js`
- `js/multichannel-engine.js`

## Observed application state

- `package.json` declares `preinstall`, `prebuild`, `build`, `postbuild`, `check`, `test` and navigation/artifact verification scripts. The Node engine is set to `22.x`.
- The public Vite plugin array ends with `calloriaTryItStudioPlugin()` and does not contain the separate v7.15–v7.19 digital plugin registrations.
- `main.js` contains the native synthetic email, live-chat and social queue, digital reply composer, `finishDigitalContact()` completion flow, specialist supervisor request ledger, SLA assessment, and customer-behaviour imports used by the overlays.
- `multichannel-engine.js` defines separate `AWAITING_CUSTOMER` and `PENDING_CUSTOMER` statuses, but its original `awaitingCustomer` metric counted `PENDING_CUSTOMER` records.
- `completeDigitalContact()` accepts resolved, pending-customer and escalated dispositions after a recorded reply and case notes, without the more specific outcome-evidence checks added by v7.19.

## Verified transform ordering issue

The v7.17 transform inserts a `specialistHandoffDraft` declaration and conditional specialist validation after the disposition value is read, before the `try` block. It also adds specialist routing markup between the disposition selector and case-notes field. The v7.19 plugin required the disposition line to be immediately followed by `try {` and required the disposition field to be immediately followed by the case-notes field. Those v7.19 anchors therefore do not remain contiguous after v7.17.

There is also a transaction-order issue: v7.17 persists a newly-created specialist handoff draft after `completeDigitalContact()` succeeds, whereas the original v7.19 validator checked only the existing supervisor-request array before completion. A new specialist draft therefore was not yet visible in that array at validation time.

## v7.20 correction

- The suite runs v7.15, v7.16, v7.17 and v7.18 in that order.
- The revised evidence transform matches the exact `completeDigitalContact()` call rather than requiring a brittle prefix.
- It inserts the evidence selector before the stable case-notes field, after any specialist fields.
- It recognises a validated `specialistHandoffDraft` in the current transaction as referral evidence. The existing v7.17 persistence still commits the supervisor request after completion succeeds.

## Public source references

- https://raw.githubusercontent.com/zaksz1991/calloria/main/package.json
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js

This baseline describes the inspected public `main` snapshot. It does not claim to represent unpushed local changes.
