# CALLORIA v6.69 — Customer Promise & Callback Commitment Control

## Product change

Callback promises are now managed as owned operational work in the main 3D agent application. Recruitment remains the employment entry gate; this feature belongs to the live customer-service and after-contact workflow.

## Agent workflow

1. During inbound or outbound after-contact work, select the customer-requested callback disposition.
2. Choose an agreed callback plan: 30 simulated minutes, 60 simulated minutes, next working day at 09:00, or two working days at 10:00.
3. Record the specific outcome promised to the customer. The engine requires at least 10 characters and a valid customer, contact, owner and case reference.
4. The callback appears in the new **Promises** navigation view, assigned to the employee who made it.
5. When due or overdue, open the linked inbound or outbound callback desk from the Promises view and handle the return contact as normal agent work. The commitment is not closed by a manual button. Complete the callback interaction and its after-contact work to record whether the customer was reached, there was no answer, or further action is required. An outcome summary of at least 20 characters is required.
6. An unsuccessful first attempt is rescheduled to the next working day at 10:00 and a new callback task is created or linked. A second unsuccessful attempt moves the promise to independent supervisor review.
7. A reviewer must enter a different name from the callback owner and document at least 20 characters explaining the review decision.

## Integration details

- `public/commitment-engine.js` is loaded by `index.html` before the main application module.
- Commitment state is stored in the existing CALLORIA profile save as `customerCommitments`; older saves are migrated automatically.
- Inbound and outbound callback queue records carry `commitmentId` and linked callback due checks use the accelerated simulation date/time.
- Legacy callback records without `commitmentId` continue to use their previous wall-clock due checks.
- Outbound worklist wall-clock fields remain compatibility metadata; the commitment engine is authoritative for due eligibility of linked callbacks.
- The engine retains its two-attempt ceiling and its independent-review rule.

## Files changed

- `index.html`
- `js/main.js`
- `styles.css`
- `package.json`
- `CHANGELOG.md`
- `docs/CALLORIA-v6.69-CUSTOMER-PROMISE-COMMITMENTS.md`
- `tests/commitment-engine-v69.test.cjs`
- `tests/customer-commitments-ui-v669.test.mjs`

## Boundaries

All customers, callback requests, contact attempts, case references and due dates are simulated. This does not call real telephone networks, send real reminders or create provider-side tasks. Commitments are currently stored in the existing client profile save and should not be represented as server-authoritative multi-user commitments.
