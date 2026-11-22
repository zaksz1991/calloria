# Build and test notes — v7.13

## Source findings

The public source `js/main.js` currently:

1. Calls `completeActiveCallback` unconditionally in outbound after-contact work even when `noConnectOutcome` is true; the same branch then records no-answer and schedules a retry.
2. Sets a callback directly to `completed` inside `cancelOutbound`, although its own event text states that the attempt ended before wrap-up and was referred for review.
3. Returns an inbound contact to the queue without updating the linked callback record from `in_progress`.
4. Sets a retried outbound worklist item to an arbitrary timestamp one minute from now, rather than copying the new callback record's `dueAt` value.

Relevant current source regions in public `main` (22 Nov 2026):
- `js/main.js`, lines 2552–2553: inbound callback completion after wrap-up validation.
- `js/main.js`, lines 2589–2607: outbound no-connect determination and unconditional callback completion.
- `js/main.js`, lines 1786–1818: commitment retry and mismatched one-minute worklist deadline.
- `js/main.js`, lines 2691–2695: inbound return-to-queue path.
- `js/main.js`, lines 2830–2838: outbound cancel marks callback `completed` despite the attempt being abandoned.
- `js/operations-engine.js`, lines 151–159: existing generic completion helper hardcodes `completed`.

Sources inspected:
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/main.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/operations-engine.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/js/campaign-operations-engine.js`
- `https://raw.githubusercontent.com/zaksz1991/calloria/main/vite.config.js`

## Tests performed locally

- 15 focused Node regression tests passed before packaging.
- Source transform exercised after the v7.12 Promise Control transform.
- Transform idempotency and safe-skip behaviour tested.
- No full repository Vite build was run because a current full source checkout and all binary model assets were not available in the execution workspace.
- No live Vercel deployment or phone browser was tested.
