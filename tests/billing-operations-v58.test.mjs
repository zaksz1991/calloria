import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/billing-operations-engine.js');

const BASE = '2026-11-11T10:00:00.000Z';
const TOMORROW = '2026-11-12';
function fresh() { return E.createInitialState(BASE); }
function makeOrder(state, overrides = {}) {
  return E.createOrder(state, {
    customerId: 'CUS-9100', customerName: 'Example Services Ltd', productId: 'ruffneck-lms', productName: 'RuffNeck LMS',
    description: 'Annual platform subscription and implementation support.', frequency: 'One-time', currency: 'NGN', amount: 125000,
    startDate: '2026-11-11', owner: 'Sales Desk', termsDays: 14, ...overrides
  }, BASE);
}
function approvedOrder(state, overrides = {}) {
  const order = makeOrder(state, overrides);
  E.approveOrder(state, order.id, { approvedBy: 'Finance Supervisor', acceptanceEvidence: 'Customer signed the accepted order form and scope confirmation.', scopeConfirmed: 'One-time platform setup with the agreed annual service entitlement.' }, BASE);
  return order;
}
function issuedInvoice(state, overrides = {}) {
  const order = approvedOrder(state);
  const invoice = E.createInvoice(state, order.id, { subtotal: order.amount, taxAmount: 0, periodStart: '2026-11-11', ...overrides }, BASE);
  E.issueInvoice(state, invoice.id, { issuedBy: 'Billing Officer', dueAt: TOMORROW }, BASE);
  return { order, invoice };
}
function receipt(state, overrides = {}) {
  return E.recordPayment(state, {
    externalReference: 'BANK-REF-900001', customerId: 'CUS-9100', customerName: 'Example Services Ltd', currency: 'NGN', amount: 80000,
    method: 'Bank transfer', receivedAt: BASE, recordedBy: 'Cash Officer', verifiedBy: 'Reconciliation Supervisor',
    verificationEvidence: 'Bank statement credit line independently matched to the customer remittance advice.', ...overrides
  }, BASE);
}
function allocate(state, payment, invoice, value = 50000) { return E.allocatePayment(state, payment.id, invoice.id, value, BASE); }

test('version and storage contracts are stable', () => {
  assert.equal(E.VERSION, '5.8.0');
  assert.equal(E.STORAGE_KEY, 'calloria.billing-operations.v58');
  assert.equal(E.SALES_KEY, 'calloria.sales-operations.v57');
  assert.equal(E.CUSTOMER_KEY, 'calloria.customer-journey.v54');
});
test('initial workspace contains only marked synthetic financial records', () => {
  const state = fresh();
  assert.ok(state.orders.length && state.invoices.length && state.payments.length);
  assert.ok(state.orders.every((x) => x.demo));
  assert.ok(state.invoices.every((x) => x.demo));
  assert.ok(state.payments.every((x) => x.demo));
});
test('state normalisation repairs malformed collections', () => {
  const state = E.normaliseState({ orders: null, invoices: 'bad', payments: null, refunds: null, activity: null }, BASE);
  assert.ok(Array.isArray(state.orders)); assert.ok(Array.isArray(state.invoices)); assert.ok(Array.isArray(state.payments)); assert.ok(Array.isArray(state.refunds)); assert.ok(Array.isArray(state.activity));
});
test('load returns demo state for empty storage', () => {
  assert.equal(E.load({ getItem: () => null }).version, E.VERSION);
});
test('load tolerates invalid JSON', () => {
  assert.ok(E.load({ getItem: () => '{bad' }).orders.length > 0);
});
test('save persists JSON state', () => {
  let saved = ''; assert.equal(E.save(fresh(), { setItem: (_key, value) => { saved = value; } }), true);
  assert.equal(JSON.parse(saved).version, E.VERSION);
});
test('save safely reports storage quota failure', () => {
  assert.equal(E.save(fresh(), { setItem: () => { throw new Error('quota'); } }), false);
});
test('clean removes markup and control characters', () => {
  assert.equal(E.clean(' <service>\nentry\u0000 '), 'service entry');
});
test('amount rejects negatives and zero for mandatory amounts', () => {
  assert.throws(() => E.amount(-1), /positive amount/i); assert.throws(() => E.amount(0), /positive amount/i);
});
test('amount supports explicit zero for optional tax amount', () => {
  assert.equal(E.amount('0', 'Tax', true), 0);
});
test('amount rejects values beyond the documented input limit', () => {
  assert.throws(() => E.amount('1000000000001'), /valid positive amount/i);
});
test('currency formatter uses requested currency', () => {
  assert.match(E.money(1000, 'NGN'), /NGN|₦/);
});
test('creates a draft order with a generated reference', () => {
  const order = makeOrder(fresh()); assert.equal(order.status, 'Draft'); assert.match(order.reference, /^ORD-2026-/);
});
test('rejects an order without a customer identity', () => {
  assert.throws(() => makeOrder(fresh(), { customerName: '', customerId: '' }), /customer or organisation/i);
});
test('rejects an order without a product or service', () => {
  assert.throws(() => makeOrder(fresh(), { productName: '' }), /product or service/i);
});
test('rejects an unsupported currency', () => {
  assert.throws(() => makeOrder(fresh(), { currency: 'XYZ' }), /supported currency/i);
});
test('rejects an invalid billing frequency', () => {
  assert.throws(() => makeOrder(fresh(), { frequency: 'Weekly' }), /billing frequency/i);
});
test('rejects an end date before the order start date', () => {
  assert.throws(() => makeOrder(fresh(), { endDate: '2026-11-10' }), /cannot precede/i);
});
test('rejects payment terms outside 0 to 120 days', () => {
  assert.throws(() => makeOrder(fresh(), { termsDays: 121 }), /between 0 and 120/i);
});
test('source opportunity cannot be imported into two orders', () => {
  const state = fresh(); makeOrder(state, { sourceOpportunityId: 'opp-100', sourceOpportunityReference: 'SO-100' });
  assert.throws(() => makeOrder(state, { sourceOpportunityId: 'opp-100', sourceOpportunityReference: 'SO-100' }), /already exists/i);
});
test('imports only won sales opportunities and marks resulting orders as draft', () => {
  const state = fresh(); const result = E.importWonOpportunities(state, { opportunities: [
    { id: 'opp-1', reference: 'SO-1', stage: 'Won', customerId: 'CUS-9101', customerName: 'Won Customer', productId: 'ruffneck-connect', estimatedValue: 250000, outcome: { evidence: 'Signed acceptance evidence for the test opportunity.' } },
    { id: 'opp-2', reference: 'SO-2', stage: 'Lost', estimatedValue: 100000 }
  ] }, BASE);
  assert.equal(result.created.length, 1); assert.equal(result.skipped.length, 0); assert.equal(result.created[0].status, 'Draft'); assert.equal(result.created[0].productName, 'RuffNeck Connect');
});
test('won sales opportunity without a positive estimate is skipped', () => {
  const result = E.importWonOpportunities(fresh(), { opportunities: [{ id: 'opp-z', stage: 'Won', estimatedValue: 0, customerName: 'Won Customer' }] }, BASE);
  assert.equal(result.created.length, 0); assert.match(result.skipped[0].reason, /no positive/i);
});
test('re-importing a won opportunity skips its existing order', () => {
  const state = fresh(); const sales = { opportunities: [{ id: 'opp-1', stage: 'Won', reference: 'SO-1', customerName: 'Won Customer', productId: 'ruffneck-lms', estimatedValue: 5000 }] };
  E.importWonOpportunities(state, sales, BASE); const second = E.importWonOpportunities(state, sales, BASE);
  assert.equal(second.created.length, 0); assert.equal(second.skipped.length, 1);
});
test('order approval requires another person from the order owner', () => {
  const state = fresh(); const order = makeOrder(state);
  assert.throws(() => E.approveOrder(state, order.id, { approvedBy: 'Sales Desk', acceptanceEvidence: 'Customer accepted the order in writing.', scopeConfirmed: 'The agreed scope is complete and clear.' }, BASE), /different person/i);
});
test('order approval requires customer acceptance and scope evidence', () => {
  const state = fresh(); const order = makeOrder(state);
  assert.throws(() => E.approveOrder(state, order.id, { approvedBy: 'Finance Supervisor', acceptanceEvidence: 'ok', scopeConfirmed: 'tiny' }, BASE), /at least 20 characters/i);
});
test('approves a draft order after independent evidence review', () => {
  const state = fresh(); const order = approvedOrder(state); assert.equal(order.status, 'Approved'); assert.equal(order.approvedBy, 'Finance Supervisor');
});
test('only approved recurring orders can be activated', () => {
  const state = fresh(); const order = approvedOrder(state, { frequency: 'Monthly' });
  assert.equal(E.activateOrder(state, order.id, 'Service Manager', BASE).status, 'Active');
});
test('one-time order release remains an approved fulfilment order', () => {
  const state = fresh(); const order = approvedOrder(state);
  assert.equal(E.activateOrder(state, order.id, 'Service Manager', BASE).status, 'Approved');
});
test('only valid order status transitions are permitted', () => {
  const state = fresh(); const order = approvedOrder(state);
  assert.equal(E.updateOrderStatus(state, order.id, 'Completed', 'Delivery and handover completed with customer evidence.', 'Operations Manager', BASE).status, 'Completed');
  assert.throws(() => E.updateOrderStatus(state, order.id, 'Active', 'Try reverse state change.', 'Ops Lead', BASE), /cannot move/i);
});
test('invoice creation requires an approved or active order', () => {
  const state = fresh(); const order = makeOrder(state);
  assert.throws(() => E.createInvoice(state, order.id, { subtotal: 1000 }), /approved or active/i);
});
test('creates a draft invoice from an approved one-time order', () => {
  const state = fresh(); const order = approvedOrder(state); const invoice = E.createInvoice(state, order.id, { subtotal: 125000, taxAmount: 0 }, BASE);
  assert.equal(invoice.status, 'Draft'); assert.equal(invoice.total, 125000); assert.match(invoice.reference, /^INV-2026-/);
});
test('tax is a separately entered amount, not calculated by the engine', () => {
  const state = fresh(); const order = approvedOrder(state); const invoice = E.createInvoice(state, order.id, { subtotal: 100000, taxAmount: 7500 }, BASE);
  assert.equal(invoice.total, 107500); assert.equal(invoice.taxAmount, 7500);
});
test('one-time order cannot receive a duplicate non-void invoice', () => {
  const state = fresh(); const order = approvedOrder(state); E.createInvoice(state, order.id, { subtotal: 125000 }, BASE);
  assert.throws(() => E.createInvoice(state, order.id, { subtotal: 125000 }, BASE), /already exists/i);
});
test('recurring invoice requires a billing period end', () => {
  const state = fresh(); const order = approvedOrder(state, { frequency: 'Monthly' }); E.activateOrder(state, order.id, 'Service Manager', BASE);
  assert.throws(() => E.createInvoice(state, order.id, { subtotal: 10000, periodStart: '2026-11-01' }, BASE), /period end date/i);
});
test('recurring invoice is unique for an order and billing period', () => {
  const state = fresh(); const order = approvedOrder(state, { frequency: 'Monthly' }); E.activateOrder(state, order.id, 'Service Manager', BASE);
  const period = { subtotal: 10000, periodStart: '2026-11-01', periodEnd: '2026-11-30' };
  E.createInvoice(state, order.id, period, BASE); assert.throws(() => E.createInvoice(state, order.id, period, BASE), /already exists/i);
});
test('only draft invoices can be issued', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); assert.throws(() => E.issueInvoice(state, invoice.id, { issuedBy: 'Billing Officer', dueAt: TOMORROW }, BASE), /only draft/i);
});
test('invoice due date cannot precede issue date', () => {
  const state = fresh(); const order = approvedOrder(state); const invoice = E.createInvoice(state, order.id, { subtotal: 1000 }, BASE);
  assert.throws(() => E.issueInvoice(state, invoice.id, { issuedBy: 'Billing Officer', dueAt: '2026-11-10' }, BASE), /before invoice issue date/i);
});
test('issue invoice locks the invoice and records issuer and due date', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); assert.equal(invoice.status, 'Issued'); assert.equal(invoice.dueAt, TOMORROW); assert.equal(invoice.issuedBy, 'Billing Officer');
});
test('void invoice requires a documented reason', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state);
  assert.throws(() => E.voidInvoice(state, invoice.id, { actor: 'Billing Manager', reason: 'bad' }, BASE), /at least 15 characters/i);
});
test('unpaid invoice can be voided with documented reason', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state);
  assert.equal(E.voidInvoice(state, invoice.id, { actor: 'Billing Manager', reason: 'Duplicate invoice was issued in error.' }, BASE).status, 'Void');
});
test('invoice with payment activity cannot be voided', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 10000);
  assert.throws(() => E.voidInvoice(state, invoice.id, { actor: 'Billing Manager', reason: 'Void attempt after allocation.' }, BASE), /cannot be voided/i);
});
test('receipt requires external reference and evidence', () => {
  assert.throws(() => receipt(fresh(), { externalReference: 'x', verificationEvidence: 'short' }), /external payment reference/i);
});
test('receipt recording and independent verification must be separated', () => {
  assert.throws(() => receipt(fresh(), { recordedBy: 'Same Person', verifiedBy: 'Same Person' }), /different people/i);
});
test('records a verified receipt without processing a payment', () => {
  const payment = receipt(fresh()); assert.equal(payment.amount, 80000); assert.equal(payment.allocations.length, 0); assert.equal(payment.verifiedBy, 'Reconciliation Supervisor');
});
test('duplicate external receipt references are rejected case-insensitively', () => {
  const state = fresh(); receipt(state);
  assert.throws(() => receipt(state, { externalReference: 'bank-ref-900001' }), /already been recorded/i);
});
test('payment allocation rejects a draft invoice', () => {
  const state = fresh(); const order = approvedOrder(state); const invoice = E.createInvoice(state, order.id, { subtotal: 100000 }, BASE); const pay = receipt(state);
  assert.throws(() => allocate(state, pay, invoice), /issued invoices/i);
});
test('payment and invoice currencies must match', () => {
  const state = fresh(); const order = approvedOrder(state, { currency: 'USD' }); const invoice = E.createInvoice(state, order.id, { subtotal: 1000 }, BASE); E.issueInvoice(state, invoice.id, { issuedBy: 'Billing Officer', dueAt: TOMORROW }, BASE); const pay = receipt(state, { currency: 'NGN', customerId: 'CUS-9100' });
  assert.throws(() => allocate(state, pay, invoice, 100), /currencies must match/i);
});
test('payment and invoice customer references must match', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state, { customerId: 'CUS-OTHER' });
  assert.throws(() => allocate(state, pay, invoice, 100), /customer does not match/i);
});
test('receipt cannot be over-allocated', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state, { amount: 40000 });
  assert.throws(() => allocate(state, pay, invoice, 50000), /unallocated receipt balance/i);
});
test('invoice cannot be overpaid through receipt allocation', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state, { amount: 150000 });
  assert.throws(() => allocate(state, pay, invoice, 150000), /invoice outstanding balance/i);
});
test('partial allocation produces a part-paid invoice and correct balance', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state);
  const result = allocate(state, pay, invoice, 30000); assert.equal(invoice.status, 'Part-paid'); assert.equal(result.balance, 95000);
});
test('full allocation marks invoice paid', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state, { subtotal: 80000 }); const pay = receipt(state, { amount: 80000 });
  allocate(state, pay, invoice, 80000); assert.equal(invoice.status, 'Paid'); assert.equal(E.invoiceBalance(state, invoice), 0);
});
test('credit note requires issued invoice and a valid amount', () => {
  const state = fresh(); const order = approvedOrder(state); const draft = E.createInvoice(state, order.id, { subtotal: 90000 }, BASE);
  assert.throws(() => E.createCreditNote(state, draft.id, { amount: 1000, reason: 'Customer agreed a correction after review.', preparedBy: 'Billing Clerk' }, BASE), /issued invoice/i);
});
test('credit note cannot exceed outstanding invoice balance', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state);
  assert.throws(() => E.createCreditNote(state, invoice.id, { amount: 125001, reason: 'Correct the invoice amount based on approved evidence.', preparedBy: 'Billing Clerk' }, BASE), /exceed the invoice outstanding/i);
});
test('credit note approval requires a person different from preparer', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const note = E.createCreditNote(state, invoice.id, { amount: 10000, reason: 'A documented service credit is being requested.', preparedBy: 'Billing Clerk' }, BASE);
  assert.throws(() => E.approveCreditNote(state, note.id, { approvedBy: 'Billing Clerk' }, BASE), /different person/i);
});
test('approved credit note applies to invoice balance', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const note = E.createCreditNote(state, invoice.id, { amount: 10000, reason: 'A documented service credit is being requested.', preparedBy: 'Billing Clerk' }, BASE);
  E.approveCreditNote(state, note.id, { approvedBy: 'Finance Controller' }, BASE); assert.equal(note.status, 'Applied'); assert.equal(E.invoiceBalance(state, invoice), 115000);
});
test('credit note is rejected if invoice balance changed before approval', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const n1 = E.createCreditNote(state, invoice.id, { amount: 70000, reason: 'First approved credit requested after review.', preparedBy: 'Clerk One' }, BASE); const n2 = E.createCreditNote(state, invoice.id, { amount: 70000, reason: 'Second credit request should fail after balance changes.', preparedBy: 'Clerk Two' }, BASE);
  E.approveCreditNote(state, n1.id, { approvedBy: 'Controller' }, BASE); assert.throws(() => E.approveCreditNote(state, n2.id, { approvedBy: 'Director' }, BASE), /balance changed/i);
});
test('only outstanding invoices can be disputed', () => {
  const state = fresh(); const order = approvedOrder(state); const invoice = E.createInvoice(state, order.id, { subtotal: 10000 }, BASE);
  assert.throws(() => E.createDispute(state, invoice.id, { reason: 'Customer disputes the amount on this invoice.', owner: 'Billing Desk' }, BASE), /issued invoice/i);
});
test('only one open dispute per invoice is permitted', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); E.createDispute(state, invoice.id, { reason: 'Customer disputes the line item and service period.', owner: 'Billing Desk' }, BASE);
  assert.throws(() => E.createDispute(state, invoice.id, { reason: 'Another dispute was raised for the same invoice.', owner: 'Finance Desk' }, BASE), /already exists/i);
});
test('open invoice dispute pauses creation of collection tasks', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); E.createDispute(state, invoice.id, { reason: 'Customer disputes the product quantity and service date.', owner: 'Billing Desk' }, BASE);
  assert.throws(() => E.createCollectionAction(state, invoice.id, { dueAt: TOMORROW, action: 'Review disputed statement and supporting order evidence.', owner: 'Collections Desk' }, BASE), /paused/i);
});
test('dispute resolution requires a controlled outcome and evidence', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const dispute = E.createDispute(state, invoice.id, { reason: 'Customer disputes the product quantity and service date.', owner: 'Billing Desk' }, BASE);
  assert.throws(() => E.resolveDispute(state, dispute.id, { outcome: 'Maybe', resolution: 'Reviewed.', resolvedBy: 'Finance Lead' }, BASE), /valid dispute outcome/i);
});
test('resolved dispute permits a new internal collection task', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const dispute = E.createDispute(state, invoice.id, { reason: 'Customer disputes the product quantity and service date.', owner: 'Billing Desk' }, BASE);
  E.resolveDispute(state, dispute.id, { outcome: 'No billing error found', resolution: 'Contract, delivery evidence and statement all match the approved order.', resolvedBy: 'Finance Lead' }, BASE);
  const task = E.createCollectionAction(state, invoice.id, { dueAt: TOMORROW, action: 'Review customer response and next internal collections step.', owner: 'Collections Desk' }, BASE); assert.equal(task.status, 'Open');
});
test('collection task completion requires an outcome and user', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const task = E.createCollectionAction(state, invoice.id, { dueAt: TOMORROW, action: 'Review account and document next collection step.', owner: 'Collections Desk' }, BASE);
  assert.throws(() => E.completeCollectionAction(state, task.id, { outcome: 'ok', completedBy: 'Desk Officer' }, BASE), /at least 10 characters/i);
});
test('collection tasks are internal only and can be completed', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const task = E.createCollectionAction(state, invoice.id, { dueAt: TOMORROW, action: 'Review account and prepare the next documented step.', owner: 'Collections Desk' }, BASE);
  assert.equal(E.completeCollectionAction(state, task.id, { outcome: 'Customer asked for a statement copy through an approved channel.', completedBy: 'Collections Supervisor' }, BASE).status, 'Completed');
});
test('refund cannot exceed payment amount allocated to invoices', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 20000);
  assert.throws(() => E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 30000, reason: 'Customer has requested a refund after review.', requestedBy: 'Cash Officer' }, BASE), /allocated payment amount/i);
});
test('refund request reserves allocated amount against duplicate requests', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 30000, reason: 'Customer has requested a partial refund after review.', requestedBy: 'Cash Officer' }, BASE);
  assert.throws(() => E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 20000, reason: 'Second refund request for the same receipt amount.', requestedBy: 'Cash Officer' }, BASE), /allocated payment amount/i);
});
test('refund approval requires separation from requester', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'Customer requested a refund for a duplicate service charge.', requestedBy: 'Cash Officer' }, BASE);
  assert.throws(() => E.approveRefund(state, refund.id, { approvedBy: 'Cash Officer' }, BASE), /different person/i);
});
test('refund request can be rejected with independent review reason', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'Customer requested a refund for a duplicate service charge.', requestedBy: 'Cash Officer' }, BASE);
  assert.equal(E.rejectRefund(state, refund.id, { rejectedBy: 'Finance Supervisor', reason: 'Supporting evidence does not show an overcharge or duplicate receipt.' }, BASE).status, 'Rejected');
});
test('refund settlement requires a separate requester, approver and settlement recorder', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'Customer requested a refund for a duplicate service charge.', requestedBy: 'Cash Officer' }, BASE);
  E.approveRefund(state, refund.id, { approvedBy: 'Finance Controller' }, BASE);
  assert.throws(() => E.settleRefund(state, refund.id, { settledBy: 'Finance Controller', settlementReference: 'BANK-RETURN-1001' }, BASE), /separate from the requester and approver/i);
});
test('manual refund settlement reverses the original invoice allocation', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'Customer requested a refund for a duplicate service charge.', requestedBy: 'Cash Officer' }, BASE);
  E.approveRefund(state, refund.id, { approvedBy: 'Finance Controller' }, BASE);
  E.settleRefund(state, refund.id, { settledBy: 'Treasury Reconciler', settlementReference: 'BANK-RETURN-1001' }, BASE);
  assert.equal(refund.status, 'Settled'); assert.equal(invoice.amountPaid, 30000); assert.equal(E.invoiceBalance(state, invoice), 95000);
});
test('settled refund does not remain double-reserved against the remaining receipt balance', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 60000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 20000, reason: 'Customer requested a refund for an agreed duplicate charge.', requestedBy: 'Cash Officer' }, BASE);
  E.approveRefund(state, refund.id, { approvedBy: 'Finance Controller' }, BASE);
  E.settleRefund(state, refund.id, { settledBy: 'Treasury Reconciler', settlementReference: 'BANK-RETURN-1002' }, BASE);
  const second = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'A further refund request supported by the payment evidence.', requestedBy: 'Cash Officer' }, BASE);
  assert.equal(second.status, 'Requested');
});
test('refund cannot be marked settled before approval', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: invoice.id, amount: 10000, reason: 'Customer requested a refund for a duplicate service charge.', requestedBy: 'Cash Officer' }, BASE);
  assert.throws(() => E.settleRefund(state, refund.id, { settledBy: 'Treasury Reconciler', settlementReference: 'BANK-RETURN-1003' }, BASE), /only approved refunds/i);
});
test('customer snapshot import reads profile summary only', () => {
  const state = fresh(); const rows = E.importCustomerSnapshot(state, { customers: [{ id: 'CUS-X', name: 'Sample Customer', status: 'Active' }] }, BASE);
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'Sample Customer'); assert.equal(state.integration.lastCustomerReadAt, BASE);
});
test('customer snapshot import rejects malformed source', () => {
  assert.throws(() => E.importCustomerSnapshot(fresh(), { customers: 'bad' }, BASE), /unavailable/i);
});
test('dashboard separates currency balances rather than adding unlike currencies', () => {
  const state = fresh(); const dash = E.buildDashboard(state, BASE);
  assert.ok(Object.hasOwn(dash.outstandingByCurrency, 'NGN'));
  assert.equal(dash.orders, state.orders.length);
});
test('dashboard aging categorises current outstanding invoices', () => {
  const state = fresh(); const dash = E.buildDashboard(state, BASE); assert.ok(dash.aging.current >= 0); assert.ok(dash.aging.days1to30 >= 0);
});
test('CSV export escapes quotes and neutralises spreadsheet formulas', () => {
  const csv = E.toCsv([{ reference: '=HYPERLINK("bad")', amount: 1 }], [{ label: 'Reference', value: 'reference' }, { label: 'Amount', value: 'amount' }]);
  assert.match(csv, /'=HYPERLINK/); assert.match(csv, /""bad""/);
});

test('rejects an unapproved payment method label', () => {
  assert.throws(() => receipt(fresh(), { method: 'Crypto wallet' }), /valid verified payment method/i);
});
test('refund must identify the payment allocation it reverses', () => {
  const state = fresh(); const { invoice } = issuedInvoice(state); const pay = receipt(state); allocate(state, pay, invoice, 20000);
  assert.throws(() => E.requestRefund(state, pay.id, { amount: 5000, reason: 'Customer has provided evidence supporting a duplicate collection.', requestedBy: 'Cash Officer' }, BASE), /select the invoice allocation/i);
});
test('refund requests cannot target an unrelated invoice', () => {
  const state = fresh(); const first = issuedInvoice(state); const secondOrder = approvedOrder(state, { customerId: 'CUS-9101', customerName: 'Other Customer' }); const second = E.createInvoice(state, secondOrder.id, { subtotal: 100000 }, BASE); E.issueInvoice(state, second.id, { issuedBy: 'Billing Officer', dueAt: TOMORROW }, BASE);
  const pay = receipt(state); allocate(state, pay, first.invoice, 20000);
  assert.throws(() => E.requestRefund(state, pay.id, { invoiceId: second.id, amount: 5000, reason: 'Customer has provided evidence supporting a duplicate collection.', requestedBy: 'Cash Officer' }, BASE), /match the source receipt customer and currency|allocated payment amount/i);
});
test('refund settlement reverses only the invoice named on its request', () => {
  const state = fresh();
  const first = issuedInvoice(state, { subtotal: 90000 });
  const secondOrder = approvedOrder(state, { customerId: 'CUS-9100', customerName: 'Example Services Ltd', amount: 60000 });
  const second = E.createInvoice(state, secondOrder.id, { subtotal: 60000 }, BASE); E.issueInvoice(state, second.id, { issuedBy: 'Billing Officer', dueAt: TOMORROW }, BASE);
  const pay = receipt(state, { amount: 80000 }); allocate(state, pay, first.invoice, 40000); allocate(state, pay, second, 40000);
  const refund = E.requestRefund(state, pay.id, { invoiceId: second.id, amount: 10000, reason: 'Customer provided evidence that the second invoice was over-allocated.', requestedBy: 'Cash Officer' }, BASE);
  E.approveRefund(state, refund.id, { approvedBy: 'Finance Controller' }, BASE);
  E.settleRefund(state, refund.id, { settledBy: 'Treasury Reconciler', settlementReference: 'BANK-RETURN-SECOND-INV' }, BASE);
  assert.equal(first.invoice.amountPaid, 40000); assert.equal(second.amountPaid, 30000);
});
