(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaBillingOperationsEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.8.0';
  const STORAGE_KEY = 'calloria.billing-operations.v58';
  const SALES_KEY = 'calloria.sales-operations.v57';
  const CUSTOMER_KEY = 'calloria.customer-journey.v54';
  const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];
  const FREQUENCIES = ['One-time', 'Monthly', 'Quarterly', 'Annually'];
  const ORDER_STATUSES = ['Draft', 'Approved', 'Active', 'Paused', 'Completed', 'Cancelled'];
  const INVOICE_STATUSES = ['Draft', 'Issued', 'Part-paid', 'Paid', 'Overdue', 'Void'];
  const PAYMENT_METHODS = ['Bank transfer', 'Card', 'Cash', 'USSD', 'Wallet', 'Other verified method'];
  const CREDIT_STATUSES = ['Draft', 'Applied', 'Rejected'];
  const REFUND_STATUSES = ['Requested', 'Approved', 'Rejected', 'Settled'];

  function clean(value, max = 800) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function iso(value) {
    const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');
    return date.toISOString();
  }
  function amount(value, label = 'Amount', allowZero = false) {
    if (value === '' || value == null) throw new Error(`${label} is required.`);
    const number = Number(value);
    if (!Number.isFinite(number) || number > 1e12 || number < (allowZero ? 0 : 0.01)) throw new Error(`${label} must be a valid ${allowZero ? 'non-negative' : 'positive'} amount.`);
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }
  function validCurrency(value) { if (!CURRENCIES.includes(value)) throw new Error('Choose a supported currency.'); return value; }
  function actor(value, field = 'User') { const result = clean(value, 100); if (result.length < 2) throw new Error(`${field} is required.`); return result; }
  function textField(value, label, min = 8, max = 800) { const result = clean(value, max); if (result.length < min) throw new Error(`${label} must contain at least ${min} characters.`); return result; }
  function dateOnly(value, label = 'Date') {
    const text = clean(value, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
    return text;
  }
  function money(value, currency = 'NGN') {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(rounded); }
    catch (_) { return `${currency} ${rounded.toFixed(2)}`; }
  }
  function pushActivity(state, message, at) {
    state.activity.unshift({ id: id('act'), at: iso(at), message: clean(message, 280) });
    state.activity = state.activity.slice(0, 300);
  }
  function event(record, message, at) {
    record.timeline = Array.isArray(record.timeline) ? record.timeline : [];
    record.timeline.unshift({ id: id('evt'), at: iso(at), message: clean(message, 500) });
    record.timeline = record.timeline.slice(0, 100);
  }
  function nextReference(state, prefix, at) {
    const year = new Date(at).getUTCFullYear();
    const key = `${prefix}-${year}-`;
    const all = [...state.orders, ...state.invoices, ...state.payments, ...state.creditNotes, ...state.refunds];
    const nums = all.map((row) => String(row.reference || '')).filter((ref) => ref.startsWith(key)).map((ref) => Number(ref.slice(key.length))).filter(Number.isFinite);
    return `${key}${String(Math.max(0, ...nums) + 1).padStart(5, '0')}`;
  }
  function createDemoState(now) {
    const current = iso(now);
    const today = current.slice(0, 10);
    const due = new Date(new Date(current).getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const order = {
      id: 'ORD-58001', reference: 'ORD-2026-58001', customerId: 'CUS-1002', customerName: 'Musa Garba',
      sourceOpportunityId: null, sourceOpportunityReference: null, productId: 'ruffneck-lms', productName: 'RuffNeck LMS',
      description: 'Demonstration annual platform access order.', frequency: 'Annually', currency: 'NGN', amount: 240000,
      startDate: today, endDate: null, status: 'Active', owner: 'Commercial Operations', approvedBy: 'Demo Supervisor',
      acceptanceEvidence: 'Synthetic demo order with recorded customer acceptance evidence.', termsDays: 14, createdAt: current, updatedAt: current, demo: true,
      timeline: [{ id: 'evt-demo-order', at: current, message: 'Synthetic demonstration order loaded.' }]
    };
    const invoice = {
      id: 'INV-58001', reference: 'INV-2026-58001', orderId: order.id, orderReference: order.reference,
      customerId: order.customerId, customerName: order.customerName, productName: order.productName,
      currency: 'NGN', subtotal: 240000, taxAmount: 0, total: 240000, periodStart: today, periodEnd: null,
      issuedAt: current, dueAt: due, status: 'Part-paid', amountPaid: 60000, amountCredited: 0,
      note: 'Synthetic sample invoice. Tax amount is an operator-entered figure, not a tax calculation.',
      createdAt: current, updatedAt: current, issuedBy: 'Demo Finance', demo: true,
      timeline: [{ id: 'evt-demo-invoice', at: current, message: 'Synthetic demonstration invoice issued.' }]
    };
    const payment = {
      id: 'PAY-58001', reference: 'RCT-2026-58001', externalReference: 'DEMO-BANK-REF-58001',
      customerId: order.customerId, customerName: order.customerName, currency: 'NGN', amount: 60000,
      method: 'Bank transfer', receivedAt: current, recordedAt: current, recordedBy: 'Demo Finance',
      verificationEvidence: 'Synthetic demonstration receipt reference; not a real payment.',
      allocations: [{ invoiceId: invoice.id, invoiceReference: invoice.reference, amount: 60000, at: current }], demo: true
    };
    return {
      version: VERSION, orders: [order], invoices: [invoice], payments: [payment], creditNotes: [], refunds: [],
      disputes: [], collections: [], activity: [{ id: 'act-demo', at: current, message: 'Billing and revenue demonstration workspace loaded with synthetic records.' }],
      settings: { defaultCurrency: 'NGN', defaultTermsDays: 14 },
      integration: { salesKey: SALES_KEY, customerKey: CUSTOMER_KEY, lastSalesImportAt: null, lastCustomerReadAt: null }
    };
  }
  function createInitialState(now) { return createDemoState(now); }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    const arr = (key) => Array.isArray(raw[key]) ? raw[key] : fresh[key];
    return {
      ...fresh, ...raw,
      orders: arr('orders').map((x) => ({ ...x, timeline: Array.isArray(x.timeline) ? x.timeline : [] })),
      invoices: arr('invoices').map((x) => ({ ...x, amountPaid: Number(x.amountPaid || 0), amountCredited: Number(x.amountCredited || 0), timeline: Array.isArray(x.timeline) ? x.timeline : [] })),
      payments: arr('payments').map((x) => ({ ...x, allocations: Array.isArray(x.allocations) ? x.allocations : [] })),
      creditNotes: arr('creditNotes'), refunds: arr('refunds'), disputes: arr('disputes'), collections: arr('collections'),
      activity: Array.isArray(raw.activity) ? raw.activity : fresh.activity,
      settings: { ...fresh.settings, ...(raw.settings || {}) },
      integration: { ...fresh.integration, ...(raw.integration || {}) }
    };
  }
  function load(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState(now);
    try { const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); return raw ? normaliseState(raw, now) : createInitialState(now); }
    catch (_) { return createInitialState(now); }
  }
  function save(state, storage) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function getOrder(state, value) { return state.orders.find((row) => row.id === value || row.reference === value) || null; }
  function getInvoice(state, value) { return state.invoices.find((row) => row.id === value || row.reference === value) || null; }
  function getPayment(state, value) { return state.payments.find((row) => row.id === value || row.reference === value) || null; }
  function getRefund(state, value) { return state.refunds.find((row) => row.id === value || row.reference === value) || null; }
  function isOpenDispute(state, invoiceId) { return state.disputes.some((row) => row.invoiceId === invoiceId && row.status === 'Open'); }
  function invoiceBalance(state, invoiceOrId) {
    const invoice = typeof invoiceOrId === 'string' ? getInvoice(state, invoiceOrId) : invoiceOrId;
    if (!invoice) throw new Error('Invoice not found.');
    return Math.max(0, Math.round((Number(invoice.total) - Number(invoice.amountPaid || 0) - Number(invoice.amountCredited || 0) + Number.EPSILON) * 100) / 100);
  }
  function recalculateInvoice(state, invoice, at) {
    if (invoice.status === 'Draft' || invoice.status === 'Void') return invoice;
    const previous = invoice.status;
    const balance = invoiceBalance(state, invoice);
    if (balance <= 0) invoice.status = 'Paid';
    else if (Number(invoice.amountPaid || 0) > 0) invoice.status = 'Part-paid';
    else if (invoice.dueAt && new Date(`${invoice.dueAt}T23:59:59Z`) < new Date(at)) invoice.status = 'Overdue';
    else invoice.status = 'Issued';
    if (invoice.status !== previous) invoice.updatedAt = iso(at);
    return invoice;
  }
  function validateOrder(input) {
    if (!input || typeof input !== 'object') throw new Error('Order details are required.');
    const customerId = clean(input.customerId, 80) || null;
    const customerName = clean(input.customerName, 140);
    if (!customerId && customerName.length < 3) throw new Error('Enter a customer or organisation name.');
    const productName = clean(input.productName, 160);
    if (productName.length < 2) throw new Error('Enter a product or service name.');
    if (!FREQUENCIES.includes(input.frequency)) throw new Error('Choose a valid billing frequency.');
    const currency = validCurrency(input.currency || 'NGN');
    const value = amount(input.amount, 'Order amount');
    const startDate = dateOnly(input.startDate, 'Start date');
    const endDate = input.endDate ? dateOnly(input.endDate, 'End date') : null;
    if (endDate && endDate < startDate) throw new Error('End date cannot precede the start date.');
    const termsDays = Number(input.termsDays == null || input.termsDays === '' ? 14 : input.termsDays);
    if (!Number.isInteger(termsDays) || termsDays < 0 || termsDays > 120) throw new Error('Payment terms must be between 0 and 120 days.');
    return {
      customerId, customerName, productId: clean(input.productId, 80) || 'manual', productName,
      description: clean(input.description, 1000), frequency: input.frequency, currency, amount: value,
      startDate, endDate, owner: actor(input.owner || 'Commercial Operations', 'Order owner'), termsDays,
      sourceOpportunityId: clean(input.sourceOpportunityId, 100) || null,
      sourceOpportunityReference: clean(input.sourceOpportunityReference, 100) || null
    };
  }
  function createOrder(state, input, at) {
    const fields = validateOrder(input);
    if (fields.sourceOpportunityId && state.orders.some((row) => row.sourceOpportunityId === fields.sourceOpportunityId)) throw new Error('A CALLORIA order already exists for this sales opportunity.');
    const now = iso(at); const order = {
      id: id('ord'), reference: nextReference(state, 'ORD', now), ...fields, status: 'Draft', approvedBy: null,
      acceptanceEvidence: '', createdAt: now, updatedAt: now, demo: false,
      timeline: [{ id: id('evt'), at: now, message: 'Order draft created.' }]
    };
    state.orders.unshift(order); pushActivity(state, `${order.reference} created for ${order.customerName}.`, now); return order;
  }
  function importWonOpportunities(state, salesState, at) {
    if (!salesState || !Array.isArray(salesState.opportunities)) throw new Error('Sales opportunity data is unavailable.');
    const created = []; const skipped = [];
    for (const opportunity of salesState.opportunities) {
      if (opportunity.stage !== 'Won') continue;
      if (state.orders.some((row) => row.sourceOpportunityId === opportunity.id)) { skipped.push({ reference: opportunity.reference, reason: 'Already imported' }); continue; }
      const proposalValue = opportunity.proposal && opportunity.proposal.estimatedValue;
      const estimated = proposalValue == null ? opportunity.estimatedValue : proposalValue;
      const value = Number(estimated);
      if (!Number.isFinite(value) || value <= 0) { skipped.push({ reference: opportunity.reference, reason: 'Won deal has no positive operator-entered amount' }); continue; }
      const now = iso(at);
      const order = createOrder(state, {
        customerId: opportunity.customerId || '', customerName: opportunity.customerName || 'Imported customer',
        productId: opportunity.productId || 'manual', productName: opportunity.productName || ({ 'ruffneck-lms': 'RuffNeck LMS', 'ruffneck-prospector': 'RuffNeck Prospector', 'ruffneck-connect': 'RuffNeck Connect', 'ruffneck-social-hub': 'RuffNeck Social Hub', 'kano-run': 'Kano Run', 'kano-keke': 'Kano Keke', sponsorship: 'Sponsorship proposal', advertising: 'Advertising opportunity' }[opportunity.productId] || opportunity.productId || 'Approved service'),
        description: `Imported from won sales opportunity ${opportunity.reference || opportunity.id}. Verify scope and order terms before approval.`,
        frequency: 'One-time', currency: opportunity.currency || 'NGN', amount: value,
        startDate: now.slice(0, 10), owner: opportunity.owner || 'Commercial Operations', termsDays: 14,
        sourceOpportunityId: opportunity.id, sourceOpportunityReference: opportunity.reference || opportunity.id
      }, now);
      order.acceptanceEvidence = clean(opportunity.outcome && opportunity.outcome.evidence || '', 800);
      event(order, 'Imported as a draft from a won v5.7 opportunity; commercial review is still required.', now);
      created.push(order);
    }
    state.integration.lastSalesImportAt = iso(at);
    return { created, skipped };
  }
  function approveOrder(state, orderId, input, at) {
    const order = getOrder(state, orderId); if (!order) throw new Error('Order not found.');
    if (order.status !== 'Draft') throw new Error('Only draft orders can be approved.');
    const approvedBy = actor(input && input.approvedBy, 'Approver');
    if (approvedBy.toLowerCase() === String(order.owner).toLowerCase()) throw new Error('Order approval requires a different person from the order creator/owner.');
    const evidence = textField(input && input.acceptanceEvidence, 'Customer acceptance evidence', 20, 1000);
    const scope = textField(input && input.scopeConfirmed, 'Confirmed scope', 15, 1000);
    const now = iso(at); order.status = 'Approved'; order.approvedBy = approvedBy; order.acceptanceEvidence = evidence; order.scopeConfirmed = scope; order.updatedAt = now;
    event(order, `Order approved by ${approvedBy}.`, now); pushActivity(state, `${order.reference} approved.`, now); return order;
  }
  function activateOrder(state, orderId, actorName, at) {
    const order = getOrder(state, orderId); if (!order) throw new Error('Order not found.');
    if (order.status !== 'Approved') throw new Error('Only approved orders can be activated.');
    const who = actor(actorName, 'Activator'); const now = iso(at);
    order.status = order.frequency === 'One-time' ? 'Approved' : 'Active';
    order.activatedBy = who; order.updatedAt = now; event(order, order.frequency === 'One-time' ? `One-time order released by ${who}.` : `Recurring order activated by ${who}.`, now);
    pushActivity(state, `${order.reference} ${order.frequency === 'One-time' ? 'released' : 'activated'}.`, now); return order;
  }
  function updateOrderStatus(state, orderId, nextStatus, reason, actorName, at) {
    const order = getOrder(state, orderId); if (!order) throw new Error('Order not found.');
    const allowed = { Approved: ['Completed', 'Cancelled'], Active: ['Paused', 'Completed', 'Cancelled'], Paused: ['Active', 'Cancelled'] };
    if (!ORDER_STATUSES.includes(nextStatus) || !(allowed[order.status] || []).includes(nextStatus)) throw new Error(`Order cannot move from ${order.status} to ${nextStatus}.`);
    const why = textField(reason, 'Status change reason', 12, 800); const who = actor(actorName, 'User'); const now = iso(at);
    order.status = nextStatus; order.updatedAt = now; event(order, `${nextStatus} by ${who}: ${why}`, now); pushActivity(state, `${order.reference} moved to ${nextStatus}.`, now); return order;
  }
  function createInvoice(state, orderId, input, at) {
    const order = getOrder(state, orderId); if (!order) throw new Error('Order not found.');
    if (!['Approved', 'Active'].includes(order.status)) throw new Error('Only approved or active orders can be invoiced.');
    const periodStart = input && input.periodStart ? dateOnly(input.periodStart, 'Period start') : order.startDate;
    const periodEnd = input && input.periodEnd ? dateOnly(input.periodEnd, 'Period end') : null;
    if (periodEnd && periodEnd < periodStart) throw new Error('Billing period end cannot precede period start.');
    if (order.frequency !== 'One-time' && !periodEnd) throw new Error('Recurring invoices require a billing period end date.');
    if (order.frequency === 'One-time' && state.invoices.some((row) => row.orderId === order.id && row.status !== 'Void')) throw new Error('A non-void invoice already exists for this one-time order.');
    if (order.frequency !== 'One-time' && state.invoices.some((row) => row.orderId === order.id && row.periodStart === periodStart && row.periodEnd === periodEnd && row.status !== 'Void')) throw new Error('An invoice already exists for this order and billing period.');
    const subtotal = amount(input && input.subtotal == null ? order.amount : input.subtotal, 'Invoice subtotal');
    const taxAmount = amount(input && input.taxAmount == null ? 0 : input.taxAmount, 'Tax amount', true);
    const total = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;
    const now = iso(at);
    const invoice = {
      id: id('inv'), reference: nextReference(state, 'INV', now), orderId: order.id, orderReference: order.reference,
      customerId: order.customerId, customerName: order.customerName, productName: order.productName,
      currency: order.currency, subtotal, taxAmount, total, periodStart, periodEnd,
      issuedAt: null, dueAt: null, status: 'Draft', amountPaid: 0, amountCredited: 0,
      note: clean(input && input.note, 1000), createdAt: now, updatedAt: now, issuedBy: null, demo: false,
      timeline: [{ id: id('evt'), at: now, message: 'Invoice draft created. Amounts must be reviewed before issue.' }]
    };
    state.invoices.unshift(invoice); event(order, `Invoice draft ${invoice.reference} created.`, now); pushActivity(state, `${invoice.reference} drafted for ${order.reference}.`, now); return invoice;
  }
  function issueInvoice(state, invoiceId, input, at) {
    const invoice = getInvoice(state, invoiceId); if (!invoice) throw new Error('Invoice not found.');
    if (invoice.status !== 'Draft') throw new Error('Only draft invoices can be issued.');
    const issuer = actor(input && input.issuedBy, 'Issuer');
    const dueAt = dateOnly(input && input.dueAt, 'Due date');
    const issueDate = iso(at).slice(0, 10);
    if (dueAt < issueDate) throw new Error('Due date cannot be before invoice issue date.');
    const now = iso(at); invoice.status = 'Issued'; invoice.issuedAt = now; invoice.dueAt = dueAt; invoice.issuedBy = issuer; invoice.updatedAt = now;
    event(invoice, `Invoice issued by ${issuer}; due ${dueAt}. Issued invoice is locked; corrections require a credit note.`, now);
    pushActivity(state, `${invoice.reference} issued.`, now); return invoice;
  }
  function voidInvoice(state, invoiceId, input, at) {
    const invoice = getInvoice(state, invoiceId); if (!invoice) throw new Error('Invoice not found.');
    if (invoice.status === 'Void' || invoice.status === 'Paid' || Number(invoice.amountPaid || 0) > 0 || Number(invoice.amountCredited || 0) > 0) throw new Error('Invoice cannot be voided after payment or credit activity, or after it is already void.');
    const reason = textField(input && input.reason, 'Void reason', 15, 800); const who = actor(input && input.actor, 'User');
    const now = iso(at); invoice.status = 'Void'; invoice.voidReason = reason; invoice.voidedBy = who; invoice.updatedAt = now;
    event(invoice, `Voided by ${who}: ${reason}`, now); pushActivity(state, `${invoice.reference} voided.`, now); return invoice;
  }
  function recordPayment(state, input, at) {
    const reference = clean(input && input.externalReference, 120);
    if (reference.length < 5) throw new Error('A verified external payment reference from the bank, processor or receipt is required.');
    if (state.payments.some((row) => row.externalReference.toLowerCase() === reference.toLowerCase())) throw new Error('This external payment reference has already been recorded.');
    const currency = validCurrency(input && input.currency || 'NGN');
    if (!PAYMENT_METHODS.includes(input && input.method)) throw new Error('Choose a valid verified payment method.');
    const verifiedBy = actor(input && input.verifiedBy, 'Payment verifier');
    const recordedBy = actor(input && input.recordedBy || verifiedBy, 'Recorder');
    if (recordedBy.toLowerCase() === verifiedBy.toLowerCase()) throw new Error('Payment recording and independent verification must be performed by different people.');
    const evidence = textField(input && input.verificationEvidence, 'Payment verification evidence', 15, 1000);
    const receivedAt = iso(input && input.receivedAt || at); const now = iso(at);
    const payment = {
      id: id('pay'), reference: nextReference(state, 'RCT', now), externalReference: reference,
      customerId: clean(input && input.customerId, 80) || null, customerName: clean(input && input.customerName, 140),
      currency, amount: amount(input && input.amount, 'Payment amount'), method: PAYMENT_METHODS.includes(input && input.method) ? input.method : 'Other verified method',
      receivedAt, recordedAt: now, recordedBy, verifiedBy,
      verificationEvidence: evidence, allocations: [], demo: false
    };
    state.payments.unshift(payment); pushActivity(state, `${payment.reference} recorded as a verified receipt; no payment was processed by CALLORIA.`, now); return payment;
  }
  function allocatePayment(state, paymentId, invoiceId, value, at) {
    const payment = getPayment(state, paymentId); const invoice = getInvoice(state, invoiceId);
    if (!payment) throw new Error('Payment receipt not found.'); if (!invoice) throw new Error('Invoice not found.');
    if (invoice.status === 'Draft' || invoice.status === 'Void') throw new Error('Payments can only be allocated to issued invoices.');
    if (payment.currency !== invoice.currency) throw new Error('Payment and invoice currencies must match. No foreign-exchange conversion is performed.');
    if (payment.customerId && invoice.customerId && payment.customerId !== invoice.customerId) throw new Error('Payment customer does not match the invoice customer.');
    const allocationAmount = amount(value, 'Allocation amount');
    const alreadyAllocated = payment.allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const refundReserved = state.refunds.filter((row) => row.paymentId === payment.id && ['Requested', 'Approved'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (allocationAmount > Number(payment.amount) - alreadyAllocated - refundReserved + 0.0001) throw new Error('Allocation exceeds the unallocated receipt balance.');
    const balance = invoiceBalance(state, invoice);
    if (allocationAmount > balance + 0.0001) throw new Error('Allocation exceeds the invoice outstanding balance.');
    const now = iso(at); payment.allocations.push({ invoiceId: invoice.id, invoiceReference: invoice.reference, amount: allocationAmount, at: now });
    invoice.amountPaid = Math.round((Number(invoice.amountPaid || 0) + allocationAmount + Number.EPSILON) * 100) / 100;
    recalculateInvoice(state, invoice, now); event(invoice, `${allocationAmount.toFixed(2)} ${invoice.currency} receipt allocated from ${payment.reference}.`, now);
    pushActivity(state, `${payment.reference} allocated to ${invoice.reference}.`, now); return { payment, invoice, balance: invoiceBalance(state, invoice) };
  }
  function createCreditNote(state, invoiceId, input, at) {
    const invoice = getInvoice(state, invoiceId); if (!invoice) throw new Error('Invoice not found.');
    if (['Draft', 'Void'].includes(invoice.status)) throw new Error('Credit notes require an issued invoice.');
    const value = amount(input && input.amount, 'Credit note amount');
    if (value > invoiceBalance(state, invoice) + 0.0001) throw new Error('Credit note cannot exceed the invoice outstanding balance.');
    const reason = textField(input && input.reason, 'Credit note reason', 15, 1000);
    const preparedBy = actor(input && input.preparedBy, 'Credit note preparer');
    const now = iso(at);
    const note = { id: id('crn'), reference: nextReference(state, 'CRN', now), invoiceId: invoice.id, invoiceReference: invoice.reference, customerId: invoice.customerId, customerName: invoice.customerName, currency: invoice.currency, amount: value, reason, preparedBy, approvedBy: null, status: 'Draft', createdAt: now, updatedAt: now, demo: false };
    state.creditNotes.unshift(note); pushActivity(state, `${note.reference} drafted against ${invoice.reference}.`, now); return note;
  }
  function approveCreditNote(state, creditNoteId, input, at) {
    const note = state.creditNotes.find((row) => row.id === creditNoteId || row.reference === creditNoteId); if (!note) throw new Error('Credit note not found.');
    if (note.status !== 'Draft') throw new Error('Only draft credit notes can be approved.');
    const approver = actor(input && input.approvedBy, 'Approver');
    if (approver.toLowerCase() === note.preparedBy.toLowerCase()) throw new Error('Credit note approval requires a different person from its preparer.');
    const invoice = getInvoice(state, note.invoiceId); if (!invoice || ['Draft', 'Void'].includes(invoice.status)) throw new Error('The linked invoice is not eligible for credit.');
    if (note.amount > invoiceBalance(state, invoice) + 0.0001) throw new Error('Invoice balance changed; credit note exceeds the current outstanding amount.');
    const now = iso(at); note.status = 'Applied'; note.approvedBy = approver; note.appliedAt = now; note.updatedAt = now;
    invoice.amountCredited = Math.round((Number(invoice.amountCredited || 0) + note.amount + Number.EPSILON) * 100) / 100;
    recalculateInvoice(state, invoice, now); event(invoice, `${note.reference} applied by ${approver}.`, now); pushActivity(state, `${note.reference} approved and applied.`, now); return note;
  }
  function createDispute(state, invoiceId, input, at) {
    const invoice = getInvoice(state, invoiceId); if (!invoice) throw new Error('Invoice not found.');
    if (['Draft', 'Void', 'Paid'].includes(invoice.status)) throw new Error('Only an issued invoice with an outstanding balance can be disputed.');
    if (isOpenDispute(state, invoice.id)) throw new Error('An open dispute already exists for this invoice.');
    const reason = textField(input && input.reason, 'Dispute reason', 15, 1000);
    const owner = actor(input && input.owner, 'Dispute owner'); const now = iso(at);
    const dispute = { id: id('dsp'), reference: nextReference(state, 'DSP', now), invoiceId: invoice.id, invoiceReference: invoice.reference, customerId: invoice.customerId, customerName: invoice.customerName, reason, owner, status: 'Open', createdAt: now, updatedAt: now, resolution: null };
    state.disputes.unshift(dispute); pushActivity(state, `${dispute.reference} opened against ${invoice.reference}. Collections are paused.`, now); return dispute;
  }
  function resolveDispute(state, disputeId, input, at) {
    const dispute = state.disputes.find((row) => row.id === disputeId || row.reference === disputeId); if (!dispute) throw new Error('Dispute not found.');
    if (dispute.status !== 'Open') throw new Error('Only open disputes can be resolved.');
    const outcome = ['Customer accepted balance', 'Invoice correction required', 'No billing error found', 'Write-off review'].includes(input && input.outcome) ? input.outcome : null;
    if (!outcome) throw new Error('Choose a valid dispute outcome.');
    const resolution = textField(input && input.resolution, 'Dispute resolution', 20, 1000); const who = actor(input && input.resolvedBy, 'Resolver'); const now = iso(at);
    dispute.status = 'Resolved'; dispute.outcome = outcome; dispute.resolution = resolution; dispute.resolvedBy = who; dispute.resolvedAt = now; dispute.updatedAt = now;
    pushActivity(state, `${dispute.reference} resolved: ${outcome}.`, now); return dispute;
  }
  function createCollectionAction(state, invoiceId, input, at) {
    const invoice = getInvoice(state, invoiceId); if (!invoice) throw new Error('Invoice not found.');
    if (['Draft', 'Void', 'Paid'].includes(invoice.status)) throw new Error('Collections require an issued invoice with an outstanding balance.');
    if (isOpenDispute(state, invoice.id)) throw new Error('Collections are paused while an invoice dispute is open.');
    const dueAt = dateOnly(input && input.dueAt, 'Collection follow-up date');
    const action = textField(input && input.action, 'Internal collection action', 8, 500); const owner = actor(input && input.owner, 'Collection owner'); const now = iso(at);
    const item = { id: id('col'), reference: nextReference(state, 'COL', now), invoiceId: invoice.id, invoiceReference: invoice.reference, customerId: invoice.customerId, customerName: invoice.customerName, dueAt, action, owner, status: 'Open', createdAt: now, updatedAt: now, outcome: null };
    state.collections.unshift(item); pushActivity(state, `${item.reference} created as an internal collection task; no customer message was sent.`, now); return item;
  }
  function completeCollectionAction(state, collectionId, input, at) {
    const item = state.collections.find((row) => row.id === collectionId || row.reference === collectionId); if (!item) throw new Error('Collection task not found.');
    if (item.status !== 'Open') throw new Error('Only open collection tasks can be completed.');
    const outcome = textField(input && input.outcome, 'Collection outcome', 10, 800); const now = iso(at);
    item.status = 'Completed'; item.outcome = outcome; item.completedBy = actor(input && input.completedBy, 'Completing user'); item.completedAt = now; item.updatedAt = now;
    pushActivity(state, `${item.reference} completed.`, now); return item;
  }
  function requestRefund(state, paymentId, input, at) {
    const payment = getPayment(state, paymentId); if (!payment) throw new Error('Payment receipt not found.');
    const value = amount(input && input.amount, 'Refund amount');
    const invoice = getInvoice(state, input && input.invoiceId);
    if (!invoice) throw new Error('Select the invoice allocation from which this refund is being requested.');
    if (invoice.currency !== payment.currency || (payment.customerId && invoice.customerId && payment.customerId !== invoice.customerId)) throw new Error('Refund invoice must match the source receipt customer and currency.');
    const allocatedToInvoice = payment.allocations.filter((row) => row.invoiceId === invoice.id).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const alreadyReserved = state.refunds.filter((row) => row.paymentId === payment.id && row.invoiceId === invoice.id && ['Requested', 'Approved'].includes(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (value > allocatedToInvoice - alreadyReserved + 0.0001) throw new Error('Refund cannot exceed the allocated payment amount for this invoice that is not already reserved.');
    const reason = textField(input && input.reason, 'Refund reason', 15, 1000); const requester = actor(input && input.requestedBy, 'Refund requester'); const now = iso(at);
    const refund = { id: id('rfd'), reference: nextReference(state, 'RFD', now), paymentId: payment.id, paymentReference: payment.reference, invoiceId: invoice.id, invoiceReference: invoice.reference, customerId: payment.customerId, customerName: payment.customerName, currency: payment.currency, amount: value, reason, requestedBy: requester, approvedBy: null, settledBy: null, settlementReference: null, status: 'Requested', createdAt: now, updatedAt: now };
    state.refunds.unshift(refund); pushActivity(state, `${refund.reference} refund requested for ${payment.reference}.`, now); return refund;
  }
  function approveRefund(state, refundId, input, at) {
    const refund = getRefund(state, refundId); if (!refund) throw new Error('Refund request not found.');
    if (refund.status !== 'Requested') throw new Error('Only requested refunds can be approved or rejected.');
    const who = actor(input && input.approvedBy, 'Approver'); if (who.toLowerCase() === refund.requestedBy.toLowerCase()) throw new Error('Refund approval requires a different person from the requester.');
    const now = iso(at); refund.status = 'Approved'; refund.approvedBy = who; refund.updatedAt = now; refund.approvedAt = now;
    pushActivity(state, `${refund.reference} approved. Settlement remains an external/manual action.`, now); return refund;
  }
  function rejectRefund(state, refundId, input, at) {
    const refund = getRefund(state, refundId); if (!refund) throw new Error('Refund request not found.');
    if (refund.status !== 'Requested') throw new Error('Only requested refunds can be rejected.');
    const who = actor(input && input.rejectedBy, 'Reviewer'); const reason = textField(input && input.reason, 'Rejection reason', 10, 800);
    if (who.toLowerCase() === refund.requestedBy.toLowerCase()) throw new Error('Refund rejection requires a different person from the requester.');
    const now = iso(at); refund.status = 'Rejected'; refund.rejectedBy = who; refund.rejectionReason = reason; refund.updatedAt = now; pushActivity(state, `${refund.reference} rejected.`, now); return refund;
  }
  function settleRefund(state, refundId, input, at) {
    const refund = getRefund(state, refundId); if (!refund) throw new Error('Refund request not found.');
    if (refund.status !== 'Approved') throw new Error('Only approved refunds can be recorded as manually settled.');
    const who = actor(input && input.settledBy, 'Settlement recorder');
    if (who.toLowerCase() === refund.requestedBy.toLowerCase() || who.toLowerCase() === String(refund.approvedBy).toLowerCase()) throw new Error('Settlement recording requires a person separate from the requester and approver.');
    const ref = textField(input && input.settlementReference, 'External settlement reference', 5, 150);
    const payment = getPayment(state, refund.paymentId);
    if (!payment) throw new Error('The source payment receipt is missing.');
    let remainingToReverse = Number(refund.amount);
    for (let index = payment.allocations.length - 1; index >= 0 && remainingToReverse > 0.0001; index -= 1) {
      const allocation = payment.allocations[index];
      if (allocation.invoiceId !== refund.invoiceId) continue;
      const take = Math.min(Number(allocation.amount), remainingToReverse);
      if (take <= 0) continue;
      const invoice = getInvoice(state, allocation.invoiceId);
      if (!invoice || Number(invoice.amountPaid || 0) + 0.0001 < take) throw new Error('The source invoice payment ledger no longer matches this refund. Review the receipt before settlement.');
      allocation.amount = Math.round((Number(allocation.amount) - take + Number.EPSILON) * 100) / 100;
      invoice.amountPaid = Math.round((Number(invoice.amountPaid) - take + Number.EPSILON) * 100) / 100;
      recalculateInvoice(state, invoice, at);
      event(invoice, `${refund.reference} reversed ${take.toFixed(2)} ${invoice.currency} from the payment allocation.`, at);
      remainingToReverse = Math.round((remainingToReverse - take + Number.EPSILON) * 100) / 100;
    }
    if (remainingToReverse > 0.0001) throw new Error('The refund could not be fully reconciled to payment allocations.');
    const now = iso(at); refund.status = 'Settled'; refund.settledBy = who; refund.settlementReference = ref; refund.settledAt = now; refund.updatedAt = now;
    pushActivity(state, `${refund.reference} marked manually settled using external reference ${ref}; payment allocations were reversed. CALLORIA did not transfer funds.`, now); return refund;
  }
  function importSalesOpportunities(state, salesState, at) { return importWonOpportunities(state, salesState, at); }
  function importCustomerSnapshot(state, customerState, at) {
    if (!customerState || !Array.isArray(customerState.customers)) throw new Error('Customer 360 data is unavailable.');
    state.integration.lastCustomerReadAt = iso(at);
    return customerState.customers.map((row) => ({ id: row.id, name: row.name || row.fullName || row.displayName || row.id, status: row.status || 'Unknown' }));
  }
  function byCurrency(invoices, selector) {
    const result = {};
    for (const invoice of invoices) {
      const currency = invoice.currency || 'NGN';
      result[currency] = Math.round(((result[currency] || 0) + selector(invoice) + Number.EPSILON) * 100) / 100;
    }
    return result;
  }
  function buildDashboard(state, now) {
    const current = iso(now);
    for (const invoice of state.invoices) if (!['Draft', 'Void'].includes(invoice.status)) recalculateInvoice(state, invoice, current);
    const liveInvoices = state.invoices.filter((row) => !['Draft', 'Void'].includes(row.status));
    const outstandingInvoices = liveInvoices.filter((row) => invoiceBalance(state, row) > 0);
    const overdue = outstandingInvoices.filter((row) => row.status === 'Overdue');
    const paymentsUnallocated = state.payments.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) - payment.allocations.reduce((s, row) => s + Number(row.amount), 0)), 0);
    return {
      orders: state.orders.length, ordersDraft: state.orders.filter((row) => row.status === 'Draft').length,
      issuedInvoices: liveInvoices.length, paidInvoices: liveInvoices.filter((row) => row.status === 'Paid').length,
      overdueInvoices: overdue.length, openDisputes: state.disputes.filter((row) => row.status === 'Open').length,
      openCollectionTasks: state.collections.filter((row) => row.status === 'Open').length,
      refundRequests: state.refunds.filter((row) => ['Requested', 'Approved'].includes(row.status)).length,
      invoicedByCurrency: byCurrency(liveInvoices, (row) => row.total),
      outstandingByCurrency: byCurrency(outstandingInvoices, (row) => invoiceBalance(state, row)),
      paidByCurrency: byCurrency(liveInvoices, (row) => Number(row.amountPaid || 0)),
      unappliedByCurrency: state.payments.reduce((acc, payment) => { const left = Math.max(0, Number(payment.amount) - payment.allocations.reduce((sum, row) => sum + Number(row.amount), 0)); acc[payment.currency] = Math.round(((acc[payment.currency] || 0) + left + Number.EPSILON) * 100) / 100; return acc; }, {}),
      aging: {
        current: outstandingInvoices.filter((row) => row.status !== 'Overdue').length,
        days1to30: overdue.filter((row) => Math.floor((new Date(current).getTime() - new Date(`${row.dueAt}T23:59:59Z`).getTime()) / 86400000) <= 30).length,
        days31to60: overdue.filter((row) => { const days = Math.floor((new Date(current).getTime() - new Date(`${row.dueAt}T23:59:59Z`).getTime()) / 86400000); return days >= 31 && days <= 60; }).length,
        days61plus: overdue.filter((row) => Math.floor((new Date(current).getTime() - new Date(`${row.dueAt}T23:59:59Z`).getTime()) / 86400000) >= 61).length
      }
    };
  }
  function toCsv(rows, columns) {
    const cell = (value) => { let text = String(value == null ? '' : value); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    return [columns.map((column) => cell(column.label)).join(','), ...rows.map((row) => columns.map((column) => cell(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(','))].join('\r\n');
  }
  return {
    VERSION, STORAGE_KEY, SALES_KEY, CUSTOMER_KEY, CURRENCIES, FREQUENCIES, ORDER_STATUSES, INVOICE_STATUSES, PAYMENT_METHODS, CREDIT_STATUSES, REFUND_STATUSES,
    clean, iso, amount, money, dateOnly, load, save, createInitialState, normaliseState, getOrder, getInvoice, getPayment, invoiceBalance, isOpenDispute,
    createOrder, importWonOpportunities, importSalesOpportunities, approveOrder, activateOrder, updateOrderStatus,
    createInvoice, issueInvoice, voidInvoice, recordPayment, allocatePayment, createCreditNote, approveCreditNote,
    createDispute, resolveDispute, createCollectionAction, completeCollectionAction,
    requestRefund, approveRefund, rejectRefund, settleRefund, importCustomerSnapshot, buildDashboard, toCsv
  };
});
