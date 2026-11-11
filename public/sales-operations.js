(function () {
  'use strict';
  const E = window.CalloriaSalesOperationsEngine;
  if (!E) throw new Error('Sales Operations engine failed to load.');
  const $ = (selector) => document.querySelector(selector);
  const now = () => new Date();
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmtDate = (value) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled';
  const fmtMoney = (value) => value == null ? 'Not entered' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value));
  let state = E.load(localStorage, now());
  let customers = [];
  let customerState = null;
  let selectedId = state.opportunities[0] && state.opportunities[0].id;
  let pendingProposalId = null;
  let pendingFollowUpId = null;
  let toastTimer = null;

  function notify(message, isError) {
    const node = $('#toast'); node.textContent = message; node.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.className = 'toast'; }, 3500);
  }
  function persist() { if (!E.save(state, localStorage)) notify('Browser storage is unavailable or full. Changes may not persist.', true); }
  function readIntegration(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function refreshIntegrations() {
    customerState = readIntegration(E.CUSTOMER_KEY);
    customers = E.importCustomers(customerState);
    const previous = $('#form-customer').value;
    $('#form-customer').innerHTML = '<option value="">New prospect / not linked</option>' + customers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)} · ${escapeHtml(customer.id)}${customer.status !== 'Active' ? ` · ${escapeHtml(customer.status)}` : ''}</option>`).join('');
    if (customers.some((customer) => customer.id === previous)) $('#form-customer').value = previous;
    const active = customerState && Array.isArray(customerState.customers) ? customerState.customers.length : 0;
    const workbench = E.importCompletedContacts(readIntegration(E.WORKBENCH_KEY));
    $('#refresh-integrations').textContent = `Refresh data (${active} customers)`;
    return { customers: active, completedContacts: workbench.length };
  }
  function populateSelects() {
    $('#form-type').innerHTML = E.TYPES.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
    $('#form-product').innerHTML = E.PRODUCTS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    $('#form-source').innerHTML = E.SOURCES.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
    $('#form-channel').innerHTML = E.CHANNELS.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
    $('#followup-channel').innerHTML = E.CHANNELS.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
    $('#type-filter').innerHTML = '<option value="All">All types</option>' + E.TYPES.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
  }
  function filteredRows() {
    const query = $('#search').value.trim().toLowerCase(); const stage = $('#stage-filter').value; const type = $('#type-filter').value;
    return state.opportunities.filter((item) => {
      if (stage !== 'All' && item.stage !== stage) return false;
      if (type !== 'All' && item.type !== type) return false;
      const haystack = [item.reference, item.customerName, item.customerId, item.productId, E.productName(item.productId), item.need, item.owner, item.type].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function renderMetrics() {
    const dashboard = E.buildDashboard(state, now());
    $('#metric-active').textContent = dashboard.active;
    $('#metric-total').textContent = `${dashboard.total} total records`;
    $('#metric-qualified').textContent = dashboard.qualified;
    $('#metric-proposals').textContent = `${dashboard.proposals} proposals / negotiations`;
    $('#metric-pipeline').textContent = fmtMoney(dashboard.estimatedPipeline);
    $('#metric-won').textContent = fmtMoney(dashboard.wonEstimate);
    $('#metric-conversion').textContent = `${dashboard.conversionPercent}% conversion of decided deals`;
    $('#metric-followups').textContent = dashboard.openFollowUps;
    $('#metric-overdue').textContent = `${dashboard.overdueFollowUps} overdue`;
  }
  function renderList() {
    const rows = filteredRows();
    $('#record-count').textContent = `${rows.length} records`;
    if (!rows.some((item) => item.id === selectedId)) selectedId = rows[0] && rows[0].id;
    $('#opportunity-list').innerHTML = rows.length ? rows.map((item) => `<article class="opp-row ${item.id === selectedId ? 'selected' : ''}" data-opp-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(item.reference)}">
      <div class="opp-row-top"><strong>${escapeHtml(item.reference)}</strong><span class="stage-pill ${item.stage.toLowerCase()}">${escapeHtml(item.stage)}</span></div>
      <p>${escapeHtml(item.customerName)} · ${escapeHtml(E.productName(item.productId))}</p>
      <div class="opp-row-bottom"><span>${escapeHtml(item.type)} · ${escapeHtml(item.owner)}</span><span>${fmtMoney(item.estimatedValue)}</span></div>
    </article>`).join('') : '<div class="empty-state"><strong>No matching opportunities</strong><p>Create an opportunity or adjust the filters.</p></div>';
    document.querySelectorAll('[data-opp-id]').forEach((node) => {
      const select = () => { selectedId = node.dataset.oppId; renderAll(); };
      node.addEventListener('click', select);
      node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    });
    renderDetail();
  }
  function renderDetail() {
    const item = E.getOpportunity(state, selectedId); const target = $('#opportunity-detail');
    if (!item) {
      $('#detail-state').textContent = 'SELECT AN OPPORTUNITY'; $('#detail-reference').textContent = '';
      target.innerHTML = '<div class="empty-state"><div class="empty-icon">↗</div><strong>No opportunity selected</strong><p>Select a record to review qualification, proposals, follow-ups and sales controls.</p></div>'; return;
    }
    $('#detail-state').textContent = item.demo ? 'SAMPLE RECORD' : 'OPPORTUNITY DETAIL'; $('#detail-reference').textContent = item.reference;
    const suppressed = item.customerId && E.isSuppressed(state, item.customerId);
    const risk = customerState && item.customerId && E.activeServiceRisk(customerState, item.customerId);
    const actions = [];
    if (item.stage === 'New') actions.push('<button class="button primary" id="qualify">Qualify opportunity</button><button class="button danger" id="disqualify">Disqualify</button>');
    if (['Qualified', 'Proposal'].includes(item.stage)) actions.push('<button class="button primary" id="prepare-proposal">Prepare proposal</button>');
    if (item.stage === 'Proposal') actions.push('<button class="button secondary" id="advance-negotiation">Move to negotiation</button>');
    if (['Proposal', 'Negotiation'].includes(item.stage)) actions.push('<button class="button primary" id="mark-won">Record as won</button>');
    if (E.ACTIVE_STAGES.includes(item.stage)) actions.push('<button class="button secondary" id="schedule-followup">Schedule follow-up</button>');
    if (['Qualified', 'Proposal', 'Negotiation'].includes(item.stage)) actions.push('<button class="button danger" id="mark-lost">Record as lost</button>');
    if (item.customerId && !suppressed && E.ACTIVE_STAGES.includes(item.stage)) actions.push('<button class="button danger" id="do-not-contact">Do not contact</button>');
    if (item.customerId) actions.push('<button class="button secondary" id="sync-customer-note">Add summary to Customer 360</button>');
    const followups = item.followUps.length ? item.followUps.map((followUp) => `<div class="followup-card"><div><strong>${escapeHtml(followUp.action)}</strong><small>${escapeHtml(followUp.channel)} · ${fmtDate(followUp.dueAt)} · ${escapeHtml(followUp.owner)}</small></div><div>${followUp.status === 'Scheduled' ? `<button class="table-action" data-complete-followup="${escapeHtml(followUp.id)}">Record outcome</button>` : `<span class="stage-pill">${escapeHtml(followUp.status)}</span>`}</div></div>`).join('') : '<p>No follow-ups recorded.</p>';
    const timeline = item.timeline.slice(0, 10).map((row) => `<div class="timeline-item"><time>${fmtDate(row.at)}</time><p>${escapeHtml(row.text)}</p></div>`).join('');
    const proposal = item.proposal ? `<div class="detail-section"><h3>Proposal draft · ${escapeHtml(item.proposal.status)}</h3><p><strong>Summary:</strong> ${escapeHtml(item.proposal.summary)}</p><p><strong>Terms:</strong> ${escapeHtml(item.proposal.terms)}</p><p><strong>Disclosures:</strong> ${escapeHtml(item.proposal.disclosures)}</p><div class="facts"><div class="fact"><span>ESTIMATED VALUE</span><strong>${fmtMoney(item.proposal.estimatedValue)}</strong></div><div class="fact"><span>DISCOUNT</span><strong>${item.proposal.discountPercent}%</strong></div><div class="fact"><span>ESTIMATE BASIS</span><strong>${escapeHtml(item.proposal.basis)}</strong></div></div></div>` : '';
    const outcome = item.outcome ? `<div class="guardrail"><strong>${escapeHtml(item.outcome.type)} outcome.</strong> ${escapeHtml(item.outcome.evidence || item.outcome.reason || '')}</div>` : '';
    target.innerHTML = `<div class="detail-header"><div><div class="eyebrow">${escapeHtml(item.type)} · ${escapeHtml(item.source)}</div><h2>${escapeHtml(item.customerName)}</h2><p>${escapeHtml(item.customerId || 'Prospect not linked')} · ${escapeHtml(E.productName(item.productId))} · Created ${fmtDate(item.createdAt)}</p></div><div class="detail-badges"><span class="stage-pill ${item.stage.toLowerCase()}">${escapeHtml(item.stage)}</span><span class="type-pill">${escapeHtml(item.channel)}</span>${item.demo ? '<span class="type-pill">SAMPLE</span>' : ''}</div></div>
      <div class="detail-actions">${actions.join('')}</div>
      ${suppressed ? '<div class="guardrail"><strong>Do-not-contact restriction active.</strong> No further sales follow-up is allowed.</div>' : ''}
      ${risk ? '<div class="guardrail"><strong>Customer service risk detected.</strong> An open complaint, recovery or urgent P1 case exists in Customer 360. Resolve the service issue before qualifying this opportunity or record supervisor review and reason.</div>' : ''}
      <div class="detail-section"><h3>Customer need and product fit</h3><p><strong>Need:</strong> ${escapeHtml(item.need)}</p><p><strong>Fit evidence:</strong> ${escapeHtml(item.fit)}</p><p><strong>Permission:</strong> ${item.permission ? `Yes — ${escapeHtml(item.permissionNote)}` : 'Not yet recorded'}</p></div>
      <div class="facts"><div class="fact"><span>OWNER / TEAM</span><strong>${escapeHtml(item.owner)} · ${escapeHtml(item.team)}</strong></div><div class="fact"><span>ESTIMATED VALUE</span><strong>${fmtMoney(item.estimatedValue)}</strong></div><div class="fact"><span>NEXT ACTION</span><strong>${escapeHtml(item.nextAction || 'None')}</strong></div><div class="fact"><span>FOLLOW-UP DUE</span><strong>${fmtDate(item.followUpAt)}</strong></div><div class="fact"><span>MARKETING CONSENT</span><strong>${item.marketingConsent ? 'Recorded in preference source' : 'Not recorded / not assumed'}</strong></div><div class="fact"><span>RECORD TYPE</span><strong>${item.demo ? 'Demonstration sample' : 'Operator record'}</strong></div></div>
      ${proposal}${outcome}
      <div class="detail-section"><h3>Follow-up history</h3><div class="followup-list">${followups}</div></div>
      <div class="detail-section"><h3>Opportunity timeline</h3><div class="timeline">${timeline || '<p>No events recorded.</p>'}</div></div>
      <div class="detail-section"><h3>Operator notes</h3><div class="filters"><input id="note-text" type="text" maxlength="1000" placeholder="Add a factual opportunity note"><button class="button secondary" id="add-note">Add note</button></div>${item.notes.map((note) => `<p><small>${fmtDate(note.at)} · ${escapeHtml(note.author)}</small><br>${escapeHtml(note.text)}</p>`).join('')}</div>`;
    if ($('#qualify')) $('#qualify').addEventListener('click', () => {
      const suitability = window.confirm('Confirm that the offer is suitable for the customer\'s stated need, and that alternatives and limitations have been explained.');
      if (!suitability) return;
      const override = risk ? window.confirm('An open service-risk record exists. Does a supervisor approve reviewing this sales need before the complaint is resolved?') : false;
      let reason = '';
      if (override) reason = window.prompt('Enter the supervisor review and why proceeding is fair to the customer (minimum 20 characters):') || '';
      try { E.qualifyOpportunity(state, item.id, { suitabilityConfirmed: true, customerState, serviceRiskAcknowledged: override, serviceRiskReason: reason }, now()); persist(); renderAll(); notify('Opportunity qualified.'); }
      catch (error) { notify(error.message, true); }
    });
    if ($('#disqualify')) $('#disqualify').addEventListener('click', () => { const reason = window.prompt('Explain why this is not a suitable or valid opportunity (minimum 10 characters):'); if (reason == null) return; try { E.transitionStage(state, item.id, 'Disqualified', { reason }, now()); persist(); renderAll(); notify('Opportunity disqualified.'); } catch (error) { notify(error.message, true); } });
    if ($('#prepare-proposal')) $('#prepare-proposal').addEventListener('click', () => { pendingProposalId = item.id; $('#proposal-form').reset(); $('#proposal-dialog').showModal(); });
    if ($('#advance-negotiation')) $('#advance-negotiation').addEventListener('click', () => { try { E.transitionStage(state, item.id, 'Negotiation', {}, now()); persist(); renderAll(); notify('Opportunity moved to negotiation.'); } catch (error) { notify(error.message, true); } });
    if ($('#mark-won')) $('#mark-won').addEventListener('click', () => { const evidence = window.prompt('Record customer acceptance, order reference or signed agreement evidence (minimum 20 characters):'); if (evidence == null) return; try { E.transitionStage(state, item.id, 'Won', { evidence }, now()); persist(); renderAll(); notify('Won outcome recorded.'); } catch (error) { notify(error.message, true); } });
    if ($('#mark-lost')) $('#mark-lost').addEventListener('click', () => { const lossReason = window.prompt(`Choose a loss reason:\n${E.LOSS_REASONS.map((value, index) => `${index + 1}. ${value}`).join('\n')}\nEnter the exact reason label:`); if (!lossReason) return; const reason = window.prompt('Add a brief factual explanation (minimum 10 characters):'); if (reason == null) return; try { E.transitionStage(state, item.id, 'Lost', { lossReason, reason }, now()); persist(); renderAll(); notify('Lost outcome recorded.'); } catch (error) { notify(error.message, true); } });
    if ($('#schedule-followup')) $('#schedule-followup').addEventListener('click', () => { pendingFollowUpId = item.id; $('#followup-form').reset(); $('#followup-owner').value = item.owner; $('#followup-dialog').showModal(); });
    if ($('#do-not-contact')) $('#do-not-contact').addEventListener('click', () => { const reason = window.prompt('Record the customer request or lawful basis for suppressing further sales contact (minimum 10 characters):'); if (reason == null) return; try { E.setDoNotContact(state, item.customerId, reason, now()); persist(); renderAll(); notify('Customer added to the sales do-not-contact register.'); } catch (error) { notify(error.message, true); } });
    if ($('#sync-customer-note')) $('#sync-customer-note').addEventListener('click', () => syncCustomerNote(item));
    if ($('#add-note')) $('#add-note').addEventListener('click', () => { try { E.addNote(state, item.id, $('#note-text').value, item.owner, now()); persist(); renderAll(); notify('Opportunity note added.'); } catch (error) { notify(error.message, true); } });
    document.querySelectorAll('[data-complete-followup]').forEach((button) => button.addEventListener('click', () => {
      const outcome = window.prompt('Enter follow-up outcome: Completed, Customer declined, No response, or Rescheduled'); if (!outcome) return;
      try { E.completeFollowUp(state, item.id, button.dataset.completeFollowup, outcome, now()); persist(); renderAll(); notify('Follow-up outcome recorded.'); } catch (error) { notify(error.message, true); }
    }));
  }
  function renderFollowUps() {
    const dashboard = E.buildDashboard(state, now()); const rows = dashboard.dueFollowUps.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))).slice(0, 10);
    $('#followup-table').innerHTML = rows.length ? `<table><thead><tr><th>CUSTOMER / DEAL</th><th>DUE</th><th>OWNER</th><th>STATUS</th></tr></thead><tbody>${rows.map((row) => `<tr><td><button class="table-action" data-open-opp="${escapeHtml(row.opportunityId)}">${escapeHtml(row.customerName)}<br>${escapeHtml(row.reference)}</button></td><td>${fmtDate(row.dueAt)}</td><td>${escapeHtml(row.owner)}</td><td><span class="stage-pill ${row.overdue ? 'lost' : ''}">${row.overdue ? 'Overdue' : 'Scheduled'}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state" style="min-height:100px"><strong>No scheduled follow-ups</strong><p>Active opportunity commitments appear here.</p></div>';
    document.querySelectorAll('[data-open-opp]').forEach((button) => button.addEventListener('click', () => { selectedId = button.dataset.openOpp; renderAll(); }));
  }
  function renderActivity() {
    $('#activity-list').innerHTML = state.activity.slice(0, 10).map((item) => `<div class="activity-item"><p>${escapeHtml(item.message)}</p><time>${fmtDate(item.at)}</time></div>`).join('') || '<p class="empty-state">No activity.</p>';
  }
  function renderAll() { renderMetrics(); renderList(); renderFollowUps(); renderActivity(); }
  function syncCustomerNote(item) {
    if (!customerState || !Array.isArray(customerState.customers)) { notify('Customer 360 data was not found in this browser.', true); return; }
    const customer = customerState.customers.find((row) => row.id === item.customerId);
    if (!customer) { notify('Linked customer profile was not found.', true); return; }
    const message = `Sales opportunity ${item.reference}: ${item.type} for ${E.productName(item.productId)}; stage ${item.stage}; next action: ${item.nextAction}. This is a sales operations summary, not a promise of supply or price.`;
    customer.notes = Array.isArray(customer.notes) ? customer.notes : [];
    customer.notes.unshift({ id: `sales-${Date.now().toString(36)}`, at: now().toISOString(), author: item.owner, text: message });
    customer.notes = customer.notes.slice(0, 100);
    try { localStorage.setItem(E.CUSTOMER_KEY, JSON.stringify(customerState)); E.addNote(state, item.id, 'Summary explicitly synced to Customer 360 customer notes.', item.owner, now()); persist(); notify('Sales summary added to Customer 360.'); renderAll(); }
    catch (_) { notify('Customer 360 write failed. Changes were not confirmed.', true); }
  }
  function openDialog(id) { const node = document.getElementById(id); if (node && typeof node.showModal === 'function') node.showModal(); }
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $('#new-opportunity').addEventListener('click', () => { $('#opportunity-form').reset(); $('#form-owner').value = 'Sales Desk'; refreshIntegrations(); openDialog('opportunity-dialog'); });
  $('#refresh-integrations').addEventListener('click', () => { const count = refreshIntegrations(); notify(`Customer profiles: ${count.customers}. Completed contacts available to review: ${count.completedContacts}.`); });
  $('#opportunity-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const customerId = $('#form-customer').value;
      const selectedCustomer = customers.find((customer) => customer.id === customerId);
      const item = E.createOpportunity(state, {
        customerId, customerName: selectedCustomer ? selectedCustomer.name : $('#form-customer-name').value,
        type: $('#form-type').value, productId: $('#form-product').value, source: $('#form-source').value, channel: $('#form-channel').value,
        owner: $('#form-owner').value, estimatedValue: $('#form-value').value, need: $('#form-need').value, fit: $('#form-fit').value,
        nextAction: $('#form-next-action').value, followUpAt: $('#form-followup').value ? new Date($('#form-followup').value).toISOString() : null,
        permission: $('#form-permission').checked, permissionNote: $('#form-permission-note').value
      }, now());
      persist(); selectedId = item.id; $('#opportunity-dialog').close(); renderAll(); notify('Opportunity created. Qualification controls remain in place.');
    } catch (error) { notify(error.message, true); }
  });
  $('#proposal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      E.createProposal(state, pendingProposalId, { summary: $('#proposal-summary').value, terms: $('#proposal-terms').value, disclosures: $('#proposal-disclosures').value, estimatedValue: $('#proposal-value').value, discountPercent: $('#proposal-discount').value, basis: $('#proposal-basis').value, supervisorApproved: $('#proposal-approval').checked }, now());
      persist(); $('#proposal-dialog').close(); renderAll(); notify('Proposal saved as a draft. It has not been sent to a customer.');
    } catch (error) { notify(error.message, true); }
  });
  $('#followup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      E.addFollowUp(state, pendingFollowUpId, { channel: $('#followup-channel').value, dueAt: $('#followup-due').value ? new Date($('#followup-due').value).toISOString() : null, action: $('#followup-action').value, owner: $('#followup-owner').value, marketingMessage: $('#followup-marketing').checked }, now(), customerState);
      persist(); $('#followup-dialog').close(); renderAll(); notify('Follow-up scheduled. No message has been sent.');
    } catch (error) { notify(error.message, true); }
  });
  ['search', 'stage-filter', 'type-filter'].forEach((id) => document.getElementById(id).addEventListener('input', renderList));
  $('#export-csv').addEventListener('click', () => {
    const columns = [
      { label: 'Reference', value: 'reference' }, { label: 'Customer', value: 'customerName' }, { label: 'Customer ID', value: 'customerId' },
      { label: 'Type', value: 'type' }, { label: 'Product', value: (row) => E.productName(row.productId) }, { label: 'Stage', value: 'stage' },
      { label: 'Owner', value: 'owner' }, { label: 'Estimated Value NGN', value: 'estimatedValue' }, { label: 'Permission', value: (row) => row.permission ? 'Yes' : 'No' },
      { label: 'Created', value: 'createdAt' }, { label: 'Next Action', value: 'nextAction' }, { label: 'Follow-up Due', value: 'followUpAt' }
    ];
    const blob = new Blob([E.toCsv(state.opportunities, columns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'calloria-sales-opportunities-v57.csv'; link.click(); URL.revokeObjectURL(url);
  });
  $('#form-customer').addEventListener('change', () => { const customer = customers.find((row) => row.id === $('#form-customer').value); if (customer) $('#form-customer-name').value = customer.name; });
  $('#form-followup').value = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  $('#followup-due').value = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  populateSelects(); refreshIntegrations(); renderAll();
  if (!localStorage.getItem(E.STORAGE_KEY)) persist();
})();
