# Source baseline — CALLORIA v7.16

Inspected public `main` on 2026-11-22.

- `js/multichannel-engine.js`: `DIGITAL_STATUS.AWAITING_CUSTOMER` and `DIGITAL_STATUS.PENDING_CUSTOMER` are distinct values. `recordDigitalReply()` sets an assigned thread to `AWAITING_CUSTOMER`; `completeDigitalContact()` accepts the `pending_customer` disposition and writes `PENDING_CUSTOMER` as the contact status.
- `js/multichannel-engine.js`: `digitalQueueMetrics()` currently calculates its `awaitingCustomer` property from `DIGITAL_STATUS.PENDING_CUSTOMER`, conflating the active-thread and case-disposition states.
- `js/main.js`: Digital service performance displays this property under the label "Pending customer response".
- `vite.config.js`: the current plugin list ends with `calloriaTryItStudioPlugin()`. Register the v7.16 post-transform after the existing final plugin. If v7.15 is installed on the target branch, register v7.16 after v7.15.

Primary source references used for the baseline:
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/multichannel-engine.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`

The plugin uses exact anchors and skips with a Vite warning if the checked-out source has changed. It does not alter unrelated source files.
