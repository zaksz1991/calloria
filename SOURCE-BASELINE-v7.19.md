# Source baseline — v7.19

Inspection date: 22 November 2026.

Baseline: public `main` branch of `github.com/zaksz1991/calloria`.

## Files inspected

- `js/main.js`
- `js/multichannel-engine.js`
- `js/digital-customer-behaviour-engine.js`
- `vite.config.js`

## Confirmed source behaviour

1. The digital after-contact form in `renderDigital()` contains a disposition selector and case-notes textarea. It has no outcome-evidence field.
2. `finishDigitalContact(form)` reads the selected disposition and notes, then calls `completeDigitalContact(...)`.
3. `completeDigitalContact()` accepts the three supported dispositions after at least one agent reply and factual notes. It does not itself require a post-agent customer response, one-touch rationale, or a linked supervisor handoff.
4. The digital customer-behaviour engine already records pending scripted responses and `needsSupervisor` risk, while the supervisor-request ledger is available in application state.
5. `vite.config.js` uses a plugin array and the public baseline's last plugin is `calloriaTryItStudioPlugin()`.

## Transform anchors

The Vite overlay checks for exactly one occurrence of:

- The `digital-customer-behaviour-engine.js` import line.
- The `finishDigitalContact()` disposition/completion block.
- The digital disposition-to-case-notes form boundary.
- The `digitalCase` notes-to-createdAt property boundary.

If any count differs from one, it warns and skips without partially transforming `main.js`.

## Public source references

- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/digital-customer-behaviour-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js

This is a snapshot of public `main`, not a claim about any unpushed local branch. The source-transform guard will skip safely if the relevant source has drifted.
