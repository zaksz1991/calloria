(function () {
  'use strict';
  const E = window.CalloriaBillingOperationsEngine;
  if (!E) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = E.load(window.localStorage);
  let customerCount = null;
  let toastTimer = null;
  let activeAction = null;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = (value, currency) => E.money(value, currency);
  const when = (value) => value ? new Date(value).toLocaleString() : '—';
  const dateText = (value) => value || '—';
  const statusPill = (status) => `<span class="pill ${esc(String(status || '').toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(status || 'Unknown')}</span>`;
  const showToast = (message, error = false) => {
    const toast = $('#toast'); toast.textContent = message; toast.className = `toast show${error ? ' error' : ''}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
  };
  const persist = () => { if (!E.save(state, window.localStorage)) showToast('Browser storage is unavailable or full. Export records before continuing.', true); };
  const byName = (list, id) => list.find((row) => row.id === id || row.reference === id);
  const downloadCsv = (filename, csv) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  function currencyMarkup(map) {
    const entries = Object.entries(map || {});
    return entries.length ? entries.map(([currency, value]) => `<span class="currency-value">${esc(money(value, currency))} <small>${esc(currency)}</small></span>`).join('') : '<span class="currency-value">—</span>';
  }
  function renderOrders() {
    const body = $('#orders-body');
    if (!state.orders.length) { body.innerHTML = '<tr><td colspan="6"><div class="empty">No orders recorded.</div></td></tr>'; return; }
    body.innerHTML = state.orders.map((order) => {
      const actions = [];
      if (order.status === 'Draft') actions.push(`<button data-action="approve-order" data-id="${esc(order.id)}">Approve</button>`);
      if (['Approved', 'Active'].includes(order.status)) actions.push(`<button data-action="draft-invoice" data-id="${esc(order.id)}">Draft invoice</button>`);
      if (order.status === 'Approved' && order.frequency !== 'One-time') actions.push(`<button data-action="activate-order" data-id="${esc(order.id)}">Activate</button>`);
      if (order.status === 'Active') actions.push(`<button class="warn" data-action="order-pause" data-id="${esc(order.id)}">Pause</button>`);
      if (order.status === 'Paused') actions.push(`<button data-action="order-resume" data-id="${esc(order.id)}">Resume</button>`);
      if (['Approved', 'Active', 'Paused'].includes(order.status)) actions.push(`<button class="danger" data-action="order-cancel" data-id="${esc(order.id)}">Cancel</button>`);
      if (order.status === 'Approved' || order.status === 'Active') actions.push(`<button data-action="order-complete" data-id="${esc(order.id)}">Complete</button>`);
      return `<tr><td><strong>${esc(order.reference)}</strong><small>${esc(order.customerName)}${order.sourceOpportunityReference ? ` · ${esc(order.sourceOpportunityReference)}` : ''}</small></td><td><strong>${esc(order.productName)}</strong><small>${esc(order.frequency)} · ${esc(order.startDate)}</small></td><td>${esc(money(order.amount, order.currency))}</td><td>${statusPill(order.status)}</td><td>${esc(order.owner)}</td><td><div class="row-actions">${actions.join('') || '<span class="subtle">No action</span>'}</div></td></tr>`;
    }).join('');
  }
  function renderInvoices() {
    const body = $('#invoices-body'); const search = ($('#invoice-search').value || '').toLowerCase(); const filter = $('#invoice-status-filter').value;
    const rows = state.invoices.filter((invoice) => {
      const matches = [invoice.reference, invoice.orderReference, invoice.customerName, invoice.productName].join(' ').toLowerCase().includes(search);
      return matches && (filter === 'All' || invoice.status === filter);
    });
    if (!rows.length) { body.innerHTML = '<tr><td colspan="7"><div class="empty">No invoices match this view.</div></td></tr>'; return; }
    body.innerHTML = rows.map((invoice) => {
      const balance = E.invoiceBalance(state, invoice);
      const actions = [];
      if (invoice.status === 'Draft') { actions.push(`<button data-action="issue-invoice" data-id="${esc(invoice.id)}">Issue</button>`); actions.push(`<button class="danger" data-action="void-invoice" data-id="${esc(invoice.id)}">Void</button>`); }
      if (!['Draft', 'Void', 'Paid'].includes(invoice.status) && balance > 0) {
        actions.push(`<button data-action="credit-note" data-id="${esc(invoice.id)}">Credit note</button>`);
        actions.push(`<button data-action="invoice-dispute" data-id="${esc(invoice.id)}">Dispute</button>`);
        if (!E.isOpenDispute(state, invoice.id)) actions.push(`<button data-action="collection-task" data-id="${esc(invoice.id)}">Collection task</button>`);
      }
      return `<tr><td><strong>${esc(invoice.reference)}</strong><small>${esc(invoice.orderReference)} · ${esc(invoice.productName)}</small></td><td>${esc(invoice.customerName)}</td><td>${esc(dateText(invoice.issuedAt && invoice.issuedAt.slice(0, 10)))}<small>Due ${esc(dateText(invoice.dueAt))}</small></td><td>${esc(money(invoice.total, invoice.currency))}</td><td>${esc(money(balance, invoice.currency))}</td><td>${statusPill(invoice.status)}</td><td><div class="row-actions">${actions.join('') || '<span class="subtle">—</span>'}</div></td></tr>`;
    }).join('');
  }
  function renderPayments() {
    const body = $('#payments-body');
    if (!state.payments.length) { body.innerHTML = '<tr><td colspan="7"><div class="empty">No verified receipts recorded.</div></td></tr>'; return; }
    body.innerHTML = state.payments.map((payment) => {
      const allocated = payment.allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const left = Math.max(0, Number(payment.amount) - allocated);
      const actions = [];
      if (left > 0) actions.push(`<button data-action="allocate-payment" data-id="${esc(payment.id)}">Allocate</button>`);
      if (allocated > 0) actions.push(`<button data-action="request-refund" data-id="${esc(payment.id)}">Refund request</button>`);
      return `<tr><td><strong>${esc(payment.reference)}</strong><small>${esc(payment.externalReference)} · ${esc(payment.method)}</small></td><td>${esc(payment.customerName || payment.customerId || 'Unlinked')}</td><td>${esc(when(payment.receivedAt))}</td><td>${esc(money(payment.amount, payment.currency))}</td><td>${esc(money(allocated, payment.currency))}</td><td>${esc(money(left, payment.currency))}</td><td><div class="row-actions">${actions.join('') || '<span class="subtle">Fully allocated</span>'}</div></td></tr>`;
    }).join('');
  }
  function recordCard(title, subtitle, status, actions) {
    return `<div class="record-card"><div class="record-card-top"><strong>${esc(title)}</strong>${statusPill(status)}</div><p>${esc(subtitle)}</p><div class="row-actions">${actions || ''}</div></div>`;
  }
  function renderControls() {
    $('#credits-list').innerHTML = state.creditNotes.length ? state.creditNotes.map((note) => recordCard(`${note.reference} · ${money(note.amount, note.currency)}`, `${note.invoiceReference} · ${note.reason} · Prepared by ${note.preparedBy}`, note.status, note.status === 'Draft' ? `<button data-action="approve-credit" data-id="${esc(note.id)}">Approve & apply</button>` : '')).join('') : '<div class="empty">No credit notes.</div>';
    $('#disputes-list').innerHTML = state.disputes.length ? state.disputes.map((item) => recordCard(`${item.reference} · ${item.invoiceReference}`, `${item.customerName} · ${item.reason}${item.resolution ? ` · ${item.resolution}` : ''}`, item.status, item.status === 'Open' ? `<button data-action="resolve-dispute" data-id="${esc(item.id)}">Resolve</button>` : '')).join('') : '<div class="empty">No invoice disputes.</div>';
    $('#collections-list').innerHTML = state.collections.length ? state.collections.map((item) => recordCard(`${item.reference} · ${item.invoiceReference}`, `Due ${item.dueAt} · ${item.action} · ${item.owner}${item.outcome ? ` · ${item.outcome}` : ''}`, item.status, item.status === 'Open' ? `<button data-action="complete-collection" data-id="${esc(item.id)}">Complete</button>` : '')).join('') : '<div class="empty">No collection tasks.</div>';
    $('#refunds-list').innerHTML = state.refunds.length ? state.refunds.map((item) => {
      const actions = item.status === 'Requested' ? `<button data-action="approve-refund" data-id="${esc(item.id)}">Approve</button><button class="danger" data-action="reject-refund" data-id="${esc(item.id)}">Reject</button>` : item.status === 'Approved' ? `<button data-action="settle-refund" data-id="${esc(item.id)}">Record manual settlement</button>` : '';
      return recordCard(`${item.reference} · ${money(item.amount, item.currency)}`, `${item.paymentReference} · ${item.reason} · Requested by ${item.requestedBy}`, item.status, actions);
    }).join('') : '<div class="empty">No refund requests.</div>';
  }
  function renderOverview() {
    const dash = E.buildDashboard(state, new Date());
    $('#metric-orders').textContent = dash.orders; $('#metric-draft-orders').textContent = `${dash.ordersDraft} awaiting approval`;
    $('#metric-invoices').textContent = dash.issuedInvoices; $('#metric-paid-invoices').textContent = `${dash.paidInvoices} fully paid`;
    $('#metric-overdue').textContent = dash.overdueInvoices; $('#metric-disputes').textContent = dash.openDisputes;
    $('#metric-refunds').textContent = dash.refundRequests; $('#metric-collections').textContent = `${dash.openCollectionTasks} open collection tasks`;
    $('#currency-summary').innerHTML = currencyMarkup(dash.outstandingByCurrency);
    $('#unapplied-summary').innerHTML = currencyMarkup(dash.unappliedByCurrency);
    $('#aging-current').textContent = dash.aging.current; $('#aging-1-30').textContent = dash.aging.days1to30; $('#aging-31-60').textContent = dash.aging.days31to60; $('#aging-61-plus').textContent = dash.aging.days61plus;
    const attention = [
      { label: 'Draft orders awaiting independent approval', count: dash.ordersDraft },
      { label: 'Overdue invoices with balances', count: dash.overdueInvoices },
      { label: 'Open billing disputes', count: dash.openDisputes },
      { label: 'Refund requests awaiting review or settlement', count: dash.refundRequests },
      { label: 'Open internal collection tasks', count: dash.openCollectionTasks }
    ];
    $('#attention-list').innerHTML = attention.map((row) => `<div class="attention-row"><strong>${esc(row.label)}</strong><span>${row.count}</span></div>`).join('');
    $('#activity-list').innerHTML = state.activity.slice(0, 16).map((item) => `<div class="activity-item"><p>${esc(item.message)}</p><time>${esc(when(item.at))}</time></div>`).join('') || '<div class="empty">No activity.</div>';
  }
  function render() { renderOverview(); renderOrders(); renderInvoices(); renderPayments(); renderControls(); }
  function setTab(name) {
    $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${name}`));
  }
  function openOrderDialog() { $('#order-form').reset(); $('#order-form [name="startDate"]').value = new Date().toISOString().slice(0, 10); $('#order-form').showModal(); }
  function populateInvoiceOrders() {
    const select = $('#invoice-order'); const options = state.orders.filter((row) => ['Approved', 'Active'].includes(row.status));
    select.innerHTML = options.map((row) => `<option value="${esc(row.id)}">${esc(row.reference)} · ${esc(row.customerName)} · ${esc(row.productName)} (${esc(money(row.amount, row.currency))})</option>`).join('');
    if (!options.length) select.innerHTML = '<option value="">No approved or active orders</option>';
    const selected = options[0]; if (selected) $('#invoice-form [name="subtotal"]').value = selected.amount;
  }
  function openInvoiceDialog(orderId) {
    $('#invoice-form').reset(); populateInvoiceOrders();
    if (orderId) $('#invoice-order').value = orderId;
    const order = E.getOrder(state, $('#invoice-order').value);
    if (order) $('#invoice-form [name="subtotal"]').value = order.amount;
    $('#invoice-form [name="periodStart"]').value = order ? order.startDate : new Date().toISOString().slice(0, 10);
    $('#invoice-form [name="periodEnd"]').value = order && order.frequency !== 'One-time' ? (order.endDate || '') : '';
    $('#invoice-dialog').showModal();
  }
  const actionSpecs = {
    'activate-order': { title: 'Activate recurring order', help: 'Only an approved recurring order can be activated.', fields: [{ name: 'actor', label: 'Activated by', required: true }] },
    'approve-order': { title: 'Approve customer order', help: 'Approval must be completed by someone other than the order owner.', fields: [{ name: 'approvedBy', label: 'Approver', required: true }, { name: 'acceptanceEvidence', label: 'Customer acceptance evidence', type: 'textarea', required: true, min: 20 }, { name: 'scopeConfirmed', label: 'Confirmed order scope', type: 'textarea', required: true, min: 15 }] },
    'issue-invoice': { title: 'Issue invoice', help: 'Issuing locks the invoice. Changes after issue require a credit note.', fields: [{ name: 'issuedBy', label: 'Issued by', required: true }, { name: 'dueAt', label: 'Due date', type: 'date', required: true }] },
    'void-invoice': { title: 'Void invoice', help: 'A paid, credited or partially paid invoice cannot be voided.', fields: [{ name: 'actor', label: 'User', required: true }, { name: 'reason', label: 'Void reason', type: 'textarea', required: true, min: 15 }] },
    'allocate-payment': { title: 'Allocate receipt to invoice', help: 'Currencies and linked customer references must match. No FX conversion occurs.', fields: [{ name: 'invoiceId', label: 'Invoice', type: 'select-invoices', required: true }, { name: 'amount', label: 'Allocation amount', type: 'number', required: true, min: 0.01 }] },
    'credit-note': { title: 'Draft credit note', help: 'A second person must approve and apply the credit note.', fields: [{ name: 'amount', label: 'Credit amount', type: 'number', required: true, min: 0.01 }, { name: 'preparedBy', label: 'Prepared by', required: true }, { name: 'reason', label: 'Reason and supporting explanation', type: 'textarea', required: true, min: 15 }] },
    'approve-credit': { title: 'Approve and apply credit note', help: 'The approver must be different from the preparer. The amount is rechecked against the live invoice balance.', fields: [{ name: 'approvedBy', label: 'Approver', required: true }] },
    'invoice-dispute': { title: 'Open invoice dispute', help: 'Collection tasks are paused while an invoice dispute is open.', fields: [{ name: 'owner', label: 'Dispute owner', required: true }, { name: 'reason', label: 'Customer dispute summary', type: 'textarea', required: true, min: 15 }] },
    'resolve-dispute': { title: 'Resolve billing dispute', help: 'Record an evidenced outcome. Invoice corrections require a separate credit note.', fields: [{ name: 'resolvedBy', label: 'Resolved by', required: true }, { name: 'outcome', label: 'Outcome', type: 'select', options: ['Customer accepted balance', 'Invoice correction required', 'No billing error found', 'Write-off review'], required: true }, { name: 'resolution', label: 'Resolution summary', type: 'textarea', required: true, min: 20 }] },
    'collection-task': { title: 'Create internal collection task', help: 'This creates an internal task only. It does not send a customer message.', fields: [{ name: 'owner', label: 'Task owner', required: true }, { name: 'dueAt', label: 'Follow-up date', type: 'date', required: true }, { name: 'action', label: 'Internal action', type: 'textarea', required: true, min: 8 }] },
    'complete-collection': { title: 'Complete collection task', help: 'Document the result. No external communication is sent by this module.', fields: [{ name: 'completedBy', label: 'Completed by', required: true }, { name: 'outcome', label: 'Outcome', type: 'textarea', required: true, min: 10 }] },
    'request-refund': { title: 'Request refund review', help: 'The refund request must be approved by another user. CALLORIA will not transfer funds.', fields: [{ name: 'invoiceId', label: 'Invoice allocation', type: 'select-payment-invoices', required: true }, { name: 'amount', label: 'Refund amount', type: 'number', required: true, min: 0.01 }, { name: 'requestedBy', label: 'Requested by', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, min: 15 }] },
    'approve-refund': { title: 'Approve refund', help: 'Approver must be different from requester. Settlement is recorded separately.', fields: [{ name: 'approvedBy', label: 'Approver', required: true }] },
    'reject-refund': { title: 'Reject refund request', help: 'Reviewer must be different from requester.', fields: [{ name: 'rejectedBy', label: 'Reviewer', required: true }, { name: 'reason', label: 'Rejection reason', type: 'textarea', required: true, min: 10 }] },
    'settle-refund': { title: 'Record manual refund settlement', help: 'Record only after external settlement is independently confirmed. The payment allocation will be reversed in the local ledger.', fields: [{ name: 'settledBy', label: 'Settlement recorder', required: true }, { name: 'settlementReference', label: 'External settlement reference', required: true, min: 5 }] },
    'order-pause': { title: 'Pause recurring order', fields: [{ name: 'actor', label: 'User', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, min: 12 }] },
    'order-resume': { title: 'Resume recurring order', fields: [{ name: 'actor', label: 'User', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, min: 12 }] },
    'order-cancel': { title: 'Cancel order', fields: [{ name: 'actor', label: 'User', required: true }, { name: 'reason', label: 'Reason', type: 'textarea', required: true, min: 12 }] },
    'order-complete': { title: 'Complete order', fields: [{ name: 'actor', label: 'User', required: true }, { name: 'reason', label: 'Completion evidence', type: 'textarea', required: true, min: 12 }] }
  };
  function openAction(kind, id) {
    const spec = actionSpecs[kind]; if (!spec) return;
    activeAction = { kind, id };
    $('#action-title').textContent = spec.title; $('#action-eyebrow').textContent = 'CONTROLLED FINANCIAL ACTION'; $('#action-help').textContent = spec.help || '';
    const fields = $('#action-fields'); fields.replaceChildren();
    spec.fields.forEach((field) => {
      const label = document.createElement('label'); label.textContent = field.label;
      let input;
      if (field.type === 'textarea') { input = document.createElement('textarea'); input.rows = 3; }
      else if (field.type === 'select' || field.type === 'select-invoices' || field.type === 'select-payment-invoices') {
        input = document.createElement('select');
        const choices = field.type === 'select-invoices'
          ? state.invoices.filter((invoice) => { const payment = activeAction && E.getPayment(state, activeAction.id); return !['Draft', 'Void', 'Paid'].includes(invoice.status) && E.invoiceBalance(state, invoice) > 0 && (!payment || (payment.currency === invoice.currency && (!payment.customerId || !invoice.customerId || payment.customerId === invoice.customerId))); }).map((invoice) => ({ value: invoice.id, label: `${invoice.reference} · ${invoice.customerName} · ${money(E.invoiceBalance(state, invoice), invoice.currency)}` }))
          : field.type === 'select-payment-invoices'
            ? (() => { const payment = activeAction && E.getPayment(state, activeAction.id); return payment ? [...new Set(payment.allocations.filter((row) => Number(row.amount) > 0).map((row) => row.invoiceId))].map((invoiceId) => { const invoice = E.getInvoice(state, invoiceId); return invoice ? { value: invoice.id, label: `${invoice.reference} · allocated ${money(payment.allocations.filter((row) => row.invoiceId === invoice.id).reduce((sum, row) => sum + Number(row.amount), 0), payment.currency)}` } : null; }).filter(Boolean) : []; })()
            : field.options.map((value) => ({ value, label: value }));
        choices.forEach((choice) => { const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; input.appendChild(option); });
      } else { input = document.createElement('input'); input.type = field.type || 'text'; if (field.min != null) input.min = field.min; if (field.type === 'number') input.step = '0.01'; }
      input.name = field.name; input.required = !!field.required; if (field.minlength) input.minLength = field.minlength; if (field.min) input.minLength = field.type === 'number' ? 0 : field.min; input.maxLength = field.max || 1000;
      if (field.type === 'date') input.value = new Date().toISOString().slice(0, 10);
      if (field.name === 'issuedBy' || field.name === 'approvedBy' || field.name === 'preparedBy' || field.name === 'requestedBy' || field.name === 'recordedBy' || field.name === 'verifiedBy' || field.name === 'settledBy' || field.name === 'completedBy' || field.name === 'resolvedBy' || field.name === 'actor' || field.name === 'owner') input.placeholder = 'Enter staff name';
      label.appendChild(input); fields.appendChild(label);
    });
    $('#action-dialog').showModal();
  }
  function runAction(kind, id, data) {
    const now = new Date();
    switch (kind) {
      case 'approve-order': E.approveOrder(state, id, data, now); break;
      case 'activate-order': E.activateOrder(state, id, data.actor, now); break;
      case 'issue-invoice': E.issueInvoice(state, id, data, now); break;
      case 'void-invoice': E.voidInvoice(state, id, data, now); break;
      case 'allocate-payment': E.allocatePayment(state, id, data.invoiceId, data.amount, now); break;
      case 'credit-note': E.createCreditNote(state, id, data, now); break;
      case 'approve-credit': E.approveCreditNote(state, id, data, now); break;
      case 'invoice-dispute': E.createDispute(state, id, data, now); break;
      case 'resolve-dispute': E.resolveDispute(state, id, data, now); break;
      case 'collection-task': E.createCollectionAction(state, id, data, now); break;
      case 'complete-collection': E.completeCollectionAction(state, id, data, now); break;
      case 'request-refund': E.requestRefund(state, id, data, now); break;
      case 'approve-refund': E.approveRefund(state, id, data, now); break;
      case 'reject-refund': E.rejectRefund(state, id, data, now); break;
      case 'settle-refund': E.settleRefund(state, id, data, now); break;
      case 'order-pause': E.updateOrderStatus(state, id, 'Paused', data.reason, data.actor, now); break;
      case 'order-resume': E.updateOrderStatus(state, id, 'Active', data.reason, data.actor, now); break;
      case 'order-cancel': E.updateOrderStatus(state, id, 'Cancelled', data.reason, data.actor, now); break;
      case 'order-complete': E.updateOrderStatus(state, id, 'Completed', data.reason, data.actor, now); break;
      default: throw new Error('Unsupported action.');
    }
  }

  $('#new-order').addEventListener('click', openOrderDialog); $('#new-order-secondary').addEventListener('click', openOrderDialog);
  $('#order-form').addEventListener('submit', (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const order = E.createOrder(state, data); persist(); render(); event.currentTarget.closest('dialog').close(); setTab('orders'); showToast(`${order.reference} saved as draft.`); }
    catch (error) { showToast(error.message, true); }
  });
  $('#new-invoice').addEventListener('click', () => { populateInvoiceOrders(); if (!state.orders.some((row) => ['Approved', 'Active'].includes(row.status))) { showToast('Approve an order before creating an invoice.', true); return; } openInvoiceDialog(); });
  $('#invoice-order').addEventListener('change', () => { const order = E.getOrder(state, $('#invoice-order').value); if (order) { $('#invoice-form [name="subtotal"]').value = order.amount; $('#invoice-form [name="periodStart"]').value = order.startDate; $('#invoice-form [name="periodEnd"]').value = order.frequency !== 'One-time' ? (order.endDate || '') : ''; } });
  $('#invoice-form').addEventListener('submit', (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const invoice = E.createInvoice(state, data.orderId, data); persist(); render(); event.currentTarget.closest('dialog').close(); setTab('invoices'); showToast(`${invoice.reference} saved as draft.`); }
    catch (error) { showToast(error.message, true); }
  });
  $('#new-payment').addEventListener('click', () => { $('#payment-form').reset(); $('#payment-form [name="receivedAt"]').value = new Date().toISOString().slice(0, 16); $('#payment-dialog').showModal(); });
  $('#payment-form').addEventListener('submit', (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const payment = E.recordPayment(state, data); persist(); render(); event.currentTarget.closest('dialog').close(); showToast(`${payment.reference} recorded. Allocate it to an invoice.`); }
    catch (error) { showToast(error.message, true); }
  });
  $('#action-form').addEventListener('submit', (event) => {
    event.preventDefault(); if (!activeAction) return;
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { runAction(activeAction.kind, activeAction.id, data); persist(); render(); event.currentTarget.closest('dialog').close(); showToast('Financial control action recorded.'); activeAction = null; }
    catch (error) { showToast(error.message, true); }
  });
  $('#import-sales').addEventListener('click', () => {
    try { const raw = window.localStorage.getItem(E.SALES_KEY); if (!raw) throw new Error('No v5.7 Sales Operations data was found in this browser.'); const sales = JSON.parse(raw); const result = E.importWonOpportunities(state, sales, new Date()); persist(); render(); showToast(`${result.created.length} won deal(s) imported as draft order(s); ${result.skipped.length} skipped.`); setTab('orders'); }
    catch (error) { showToast(error.message, true); }
  });
  $('#refresh-customers').addEventListener('click', () => {
    try { const raw = window.localStorage.getItem(E.CUSTOMER_KEY); if (!raw) throw new Error('No v5.4 Customer 360 data was found in this browser.'); const customers = E.importCustomerSnapshot(state, JSON.parse(raw), new Date()); customerCount = customers.length; $('#customer-count').textContent = `${customerCount} profile(s) read`; persist(); showToast(`Read ${customerCount} Customer 360 profile(s).`); }
    catch (error) { showToast(error.message, true); }
  });
  $('#invoice-search').addEventListener('input', renderInvoices); $('#invoice-status-filter').addEventListener('change', renderInvoices);
  $$('.tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]'); if (close) { const dialog = document.getElementById(close.dataset.close); if (dialog) dialog.close(); return; }
    const button = event.target.closest('[data-action]'); if (!button) return;
    const kind = button.dataset.action; const recordId = button.dataset.id;
    if (kind === 'draft-invoice') { openInvoiceDialog(recordId); return; }
    openAction(kind, recordId);
  });
  $('#export-orders').addEventListener('click', () => downloadCsv('calloria-orders.csv', E.toCsv(state.orders, [
    { label: 'Order reference', value: 'reference' }, { label: 'Customer', value: 'customerName' }, { label: 'Customer ID', value: 'customerId' },
    { label: 'Product', value: 'productName' }, { label: 'Billing frequency', value: 'frequency' }, { label: 'Currency', value: 'currency' },
    { label: 'Amount', value: 'amount' }, { label: 'Status', value: 'status' }, { label: 'Owner', value: 'owner' }, { label: 'Start date', value: 'startDate' }
  ])));
  $('#export-invoices').addEventListener('click', () => downloadCsv('calloria-invoices.csv', E.toCsv(state.invoices, [
    { label: 'Invoice reference', value: 'reference' }, { label: 'Order reference', value: 'orderReference' }, { label: 'Customer', value: 'customerName' },
    { label: 'Currency', value: 'currency' }, { label: 'Subtotal', value: 'subtotal' }, { label: 'Tax amount', value: 'taxAmount' },
    { label: 'Total', value: 'total' }, { label: 'Paid', value: 'amountPaid' }, { label: 'Credited', value: 'amountCredited' },
    { label: 'Outstanding', value: (row) => E.invoiceBalance(state, row) }, { label: 'Status', value: 'status' }, { label: 'Due date', value: 'dueAt' }
  ])));
  $('#export-payments').addEventListener('click', () => downloadCsv('calloria-verified-receipts.csv', E.toCsv(state.payments, [
    { label: 'Receipt reference', value: 'reference' }, { label: 'External reference', value: 'externalReference' }, { label: 'Customer', value: 'customerName' },
    { label: 'Currency', value: 'currency' }, { label: 'Amount', value: 'amount' }, { label: 'Method', value: 'method' },
    { label: 'Received at', value: 'receivedAt' }, { label: 'Recorded by', value: 'recordedBy' }, { label: 'Verified by', value: 'verifiedBy' }
  ])));
  $('#export-controls').addEventListener('click', () => {
    const rows = [
      ...state.creditNotes.map((row) => ({ type: 'Credit note', reference: row.reference, parent: row.invoiceReference, amount: row.amount, currency: row.currency, status: row.status, owner: row.preparedBy })),
      ...state.disputes.map((row) => ({ type: 'Dispute', reference: row.reference, parent: row.invoiceReference, amount: '', currency: '', status: row.status, owner: row.owner })),
      ...state.collections.map((row) => ({ type: 'Collection task', reference: row.reference, parent: row.invoiceReference, amount: '', currency: '', status: row.status, owner: row.owner })),
      ...state.refunds.map((row) => ({ type: 'Refund', reference: row.reference, parent: row.paymentReference, amount: row.amount, currency: row.currency, status: row.status, owner: row.requestedBy }))
    ];
    downloadCsv('calloria-financial-controls.csv', E.toCsv(rows, ['type', 'reference', 'parent', 'amount', 'currency', 'status', 'owner'].map((key) => ({ label: key, value: key }))));
  });
  $('#export-activity').addEventListener('click', () => downloadCsv('calloria-billing-activity.csv', E.toCsv(state.activity, [{ label: 'Timestamp', value: 'at' }, { label: 'Activity', value: 'message' }])));
  render();
})();
