# Source baseline — CALLORIA v7.21

Audited current public repository `github.com/zaksz1991/calloria`, branch `main`, on 22 November 2026.

## Relevant files and observed anchors

- `js/multichannel-engine.js`
  - `recordDigitalReply()` records agent messages and the initial `firstResponseAt`.
  - `deliverDigitalFollowUp()` appends a later synthetic customer response.
  - `completeDigitalContact()` stores the terminal disposition and completion timestamp.
- `js/digital-sla-engine.js`
  - Header explicitly defines v6.63 as first-response SLA tracking.
  - `assessDigitalSla()` stops its existing first-response timer at `firstResponseAt`.
  - `advanceDigitalSlaMonitor()` persists first-response SLA transitions only.
- `js/main.js`
  - Imports `assessDigitalSla`, `digitalSlaDisplay`, `advanceDigitalSlaMonitor` and `digitalSlaMetrics` from `digital-sla-engine.js`.
  - In `renderDigital()`, calculates `activeSlaClass` and renders the FIRST-RESPONSE SERVICE LEVEL banner immediately before `.digital-thread`.
  - Uses `queueSimulationNowMs()` to supply the simulator's active-shift clock.
- `vite.config.js`
  - Registers `calloriaTryItStudioPlugin()` as the last plugin in the public `main` baseline.
  - The new plugin is intended to be added after that plugin, or after the v7.20 suite if already installed locally.

## Source links

- https://github.com/zaksz1991/calloria
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/digital-sla-engine.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js
- https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js

This package is an overlay, not a complete source repository. The current public Vite configuration does not show registrations for the conversational v7.15–v7.20 overlays described in previous patch notes. This v7.21 plugin is independent of those overlays.
