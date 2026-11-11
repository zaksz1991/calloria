(function () {
  'use strict';
  const E = window.CalloriaCustomerJourneyEngine;
  if (!E) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let state = E.load(window.localStorage);
  let selectedCaseId = state.cases[0] && state.cases[0].id;
  let selectedCustomerId = state.customers[0] && state.customers[0].id;
  let toastTimer;

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function fmtDate(value, withTime = true) {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value));
  }
  function fmtRemaining(ms) {
    if (ms == null) return 'Completed';
    const abs = Math.abs(ms); const hours = Math.floor(abs / 3600000); const days = Math.floor(hours / 24);
    const restHours = hours % 24; const minutes = Math.floor((abs % 3600000) / 60000);
    const value = days ? `${days}d ${restHours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
    return ms < 0 ? `${value} overdue` : `${value} remaining`;
  }
  function persist() { if (!E.save(state, window.localStorage)) notify('Browser storage is unavailable. Changes may not persist.', true); }
  function notify(message, error) {
    const node = $('#toast'); node.textContent = message; node.classList.toggle('error', !!error); node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
  }
  function productLabel(id) { return (E.PRODUCTS.find((p) => p.id === id) || E.PRODUCTS[0]).name; }
  function priorityClass(priority) { return priority.startsWith('P1') ? 'p1' : priority.startsWith('P2') ? 'p2' : priority.startsWith('P3') ? 'p3' : 'p4'; }
  function slaClass(status) { return `sla-${status.state}`; }
  function slaLabel(result) { return result.state === 'breached' ? 'SLA breached' : result.state === 'due-soon' ? 'Due soon' : result.state === 'paused' ? 'SLA paused' : result.state === 'resolved' ? 'Resolved' : 'On track'; }
  function setView(name) {
    $$('.page-view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
    $$('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    if (name === 'customers') renderCustomers();
    if (name === 'queue') renderQueue();
    if (name === 'create') populateCreateForm();
    if (name === 'reports') renderReports();
  }
  function renderMetrics() {
    const m = E.getMetrics(state, new Date());
    const cards = [
      ['Active cases', m.activeCases, `${m.newCases} new and awaiting triage`, ''],
      ['SLA breached', m.breached, 'Requires immediate review', m.breached ? 'alert' : ''],
      ['Due within 4 hours', m.dueSoon, 'Active response commitments', m.dueSoon ? 'alert' : ''],
      ['Pending customer', m.pendingCustomer, 'Customer action requested', ''],
      ['Resolved / closed', m.resolved, `${m.totalCases} total cases`, '']
    ];
    $('#metric-grid').innerHTML = cards.map(([label, value, hint, cls]) => `<div class="metric-card ${cls}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-hint">${hint}</div></div>`).join('');
    $('#nav-active-count').textContent = String(m.activeCases);
  }
  function renderQueue() {
    renderMetrics();
    const filters = { query: $('#case-search').value, status: $('#filter-status').value, priority: $('#filter-priority').value };
    const list = E.searchCases(state, filters);
    $('#queue-count').textContent = `${list.length} case${list.length === 1 ? '' : 's'}`;
    $('#case-list').innerHTML = list.length ? list.map((item) => {
      const customer = E.getCustomer(state, item.customerId); const sla = E.slaStatus(item, new Date());
      return `<article class="case-row ${item.id === selectedCaseId ? 'selected' : ''}" data-case-id="${esc(item.id)}" tabindex="0" role="button" aria-label="Open ${esc(item.reference)}">
        <div class="case-row-top"><span class="case-ref">${esc(item.reference)}</span><span class="badge ${priorityClass(item.priority)}">${esc(item.priority)}</span></div>
        <div class="case-subject">${esc(item.subject)}</div><div class="case-customer">${esc(customer ? `${customer.firstName} ${customer.lastName}` : item.customerId)} · ${esc(productLabel(item.productId))}</div>
        <div class="case-row-bottom"><span class="badge status">${esc(item.status)}</span><span class="badge ${slaClass(sla)}">${slaLabel(sla)}</span><span class="case-customer">${esc(item.owner)}</span></div></article>`;
    }).join('') : `<div class="empty-state"><div class="empty-icon">⌕</div><h3>No matching cases</h3><p>Change the search or filters to see other cases.</p></div>`;
    if (!list.some((item) => item.id === selectedCaseId)) selectedCaseId = list[0] && list[0].id;
    renderCaseDetail();
  }
  function renderCaseDetail() {
    const panel = $('#case-detail'); const item = E.getCase(state, selectedCaseId);
    if (!item) { panel.innerHTML = `<div class="empty-state"><div class="empty-icon">▤</div><h3>Select a case</h3><p>Choose a case from the queue to review its customer, SLA, ownership and timeline.</p></div>`; return; }
    const customer = E.getCustomer(state, item.customerId); const sla = E.slaStatus(item, new Date());
    const transitions = E.STATUSES.filter((status) => status === item.status || ({ New: ['Open'], Open: ['Pending Customer', 'Pending Internal', 'Resolved'], 'Pending Customer': ['Open', 'Resolved'], 'Pending Internal': ['Open', 'Resolved'], Resolved: ['Closed', 'Open'], Closed: [] }[item.status] || []).includes(status));
    const timeline = (item.timeline || []).slice(0, 18);
    const tasks = item.tasks || [];
    panel.innerHTML = `
      <div class="detail-head"><div class="detail-ref">${esc(item.reference)} · CREATED ${esc(fmtDate(item.createdAt))}</div><h2 class="detail-title">${esc(item.subject)}</h2><div class="detail-subtitle">${esc(customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown customer')} · ${esc(productLabel(item.productId))}</div><div class="detail-badges"><span class="badge ${priorityClass(item.priority)}">${esc(item.priority)}</span><span class="badge status">${esc(item.status)}</span>${item.sourceIncidentReference ? `<span class="badge status">${esc(item.sourceIncidentReference)}</span>` : ''}</div></div>
      <div class="sla-box"><div><strong>${slaLabel(sla)}</strong><br><span>${sla.state === 'resolved' ? 'Response target completed' : sla.state === 'paused' ? 'Awaiting customer information' : fmtRemaining(sla.remainingMs)}</span></div><div style="text-align:right"><span>RESPONSE TARGET</span><br><strong>${esc(fmtDate(sla.dueAt))}</strong></div></div>
      <div class="detail-section"><div class="section-title">CASE SUMMARY</div><p class="detail-description">${esc(item.description)}</p><div class="detail-meta" style="margin-top:12px"><div class="meta-cell"><small>OWNER</small><strong>${esc(item.owner)}</strong></div><div class="meta-cell"><small>TEAM</small><strong>${esc(item.team)}</strong></div><div class="meta-cell"><small>CHANNEL</small><strong>${esc(item.channel)}</strong></div><div class="meta-cell"><small>CATEGORY</small><strong>${esc(item.category)}</strong></div></div><div style="margin-top:11px"><button class="button secondary" id="open-customer-from-case" type="button">View customer 360</button></div></div>
      ${item.resolution ? `<div class="detail-section"><div class="section-title">RECORDED RESOLUTION</div><p class="detail-description">${esc(item.resolution)}</p></div>` : ''}
      <div class="detail-section"><div class="section-title">STATUS & OWNERSHIP</div><div class="inline-actions"><select class="field" id="case-status">${transitions.map((s) => `<option ${s === item.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><button class="button secondary" id="apply-status">Update status</button></div><textarea class="field" id="resolution-note" rows="2" placeholder="Required for resolution or reopening: explain the outcome or reopen reason (minimum 20 characters)." style="margin-top:7px"></textarea><div class="inline-actions" style="margin-top:8px"><input class="field" id="new-owner" value="${esc(item.owner)}" aria-label="New case owner" placeholder="Named owner"><input class="field" id="new-team" value="${esc(item.team)}" aria-label="New team" placeholder="Team"><button class="button secondary" id="assign-case">Reassign</button></div></div>
      ${item.status !== 'Closed' ? `<div class="detail-section"><div class="section-title">RECORD AN INTERACTION</div><select class="field" id="interaction-channel">${E.CHANNELS.map((channel) => `<option>${esc(channel)}</option>`).join('')}</select><select class="field" id="interaction-direction" style="margin-top:7px"><option>Inbound</option><option>Outbound</option></select><select class="field" id="interaction-visibility" style="margin-top:7px"><option>Internal</option><option>Customer-facing</option></select><textarea class="field" id="interaction-summary" rows="2" placeholder="Record what happened, action agreed and next step (minimum 15 characters)." style="margin-top:7px"></textarea><button class="button secondary" id="add-interaction" style="margin-top:7px">Add interaction record</button></div>` : ''}
      ${item.status !== 'Closed' ? `<div class="detail-section"><div class="section-title">FOLLOW-UP TASKS</div>${tasks.length ? tasks.map((task) => `<div class="task-row"><div><strong>${esc(task.title)}</strong><small>${esc(task.owner)} · due ${esc(task.dueDate)} · ${esc(task.status)}</small></div>${task.status !== 'Complete' ? `<button class="text-button" data-complete-task="${esc(task.id)}">Complete</button>` : '<span class="task-done">Complete</span>'}</div>`).join('') : '<p class="muted-copy">No follow-up tasks recorded.</p>'}<form id="add-task-form" class="mini-form"><input class="field" name="title" required minlength="5" placeholder="Follow-up task"><input class="field" name="owner" required placeholder="Owner"><input class="field" type="date" name="dueDate" required><button class="button secondary" type="submit">Add task</button></form></div>` : ''}
      <div class="detail-section"><div class="section-title">KNOWLEDGE SUGGESTIONS · v5.2</div><input class="field" id="kb-search" placeholder="Search published help articles…"><div id="kb-results" class="kb-results"><p class="muted-copy">Search the published knowledge register in the same browser origin.</p></div></div>
      <div class="detail-section"><div class="section-title">CASE TIMELINE</div><div class="timeline">${timeline.map((entry) => `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${esc(entry.type.toUpperCase())}</strong><p>${esc(entry.text)}</p><time>${esc(fmtDate(entry.at))}</time></div></div>`).join('')}</div></div>`;
    $('#open-customer-from-case').addEventListener('click', () => { selectedCustomerId = item.customerId; setView('customers'); });
    $('#apply-status').addEventListener('click', () => {
      try { E.updateStatus(state, item.id, $('#case-status').value, $('#resolution-note').value, new Date()); persist(); renderAll(); notify(`Case ${item.reference} updated.`); }
      catch (error) { notify(error.message, true); }
    });
    $('#assign-case').addEventListener('click', () => {
      try { E.assignCase(state, item.id, $('#new-owner').value, $('#new-team').value, new Date()); persist(); renderAll(); notify('Case ownership updated.'); }
      catch (error) { notify(error.message, true); }
    });
    const interactionButton = $('#add-interaction');
    if (interactionButton) interactionButton.addEventListener('click', () => {
      try { E.addInteraction(state, item.id, { channel: $('#interaction-channel').value, direction: $('#interaction-direction').value, visibility: $('#interaction-visibility').value, summary: $('#interaction-summary').value }, new Date()); persist(); renderAll(); notify('Interaction added to the case timeline.'); }
      catch (error) { notify(error.message, true); }
    });
    const taskForm = $('#add-task-form');
    if (taskForm) taskForm.addEventListener('submit', (event) => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(taskForm).entries());
      try { E.addTask(state, item.id, values, new Date()); persist(); renderAll(); notify('Follow-up task added.'); }
      catch (error) { notify(error.message, true); }
    });
    $$('[data-complete-task]').forEach((button) => button.addEventListener('click', () => {
      try { E.completeTask(state, item.id, button.dataset.completeTask, new Date()); persist(); renderAll(); notify('Follow-up task completed.'); }
      catch (error) { notify(error.message, true); }
    }));
    const kbSearch = $('#kb-search');
    kbSearch.addEventListener('input', () => renderKnowledgeSuggestions(item.id, kbSearch.value));
  }
  function renderKnowledgeSuggestions(caseId, query) {
    const results = E.searchPublishedKnowledge(query, window.localStorage, new Date());
    const node = $('#kb-results'); if (!node) return;
    node.innerHTML = results.length ? results.map((article) => `<div class="kb-result"><div><strong>${esc(article.title)}</strong><small>${esc(article.category || '')} · v${esc(article.version || 1)}</small></div><button class="text-button" data-link-kb="${esc(article.id)}">Link article</button></div>`).join('') : '<p class="muted-copy">No published articles found in the v5.2 register.</p>';
    $$('[data-link-kb]', node).forEach((button) => button.addEventListener('click', () => {
      const article = results.find((entry) => entry.id === button.dataset.linkKb);
      try { E.addArticleReference(state, caseId, article, new Date()); persist(); renderCaseDetail(); notify('Knowledge article reference added.'); }
      catch (error) { notify(error.message, true); }
    }));
  }
  function renderCustomers() {
    const query = $('#customer-search').value; const list = E.searchCustomers(state, query);
    $('#customer-count').textContent = `${list.length} profiles`;
    $('#customer-list').innerHTML = list.map((customer) => `<div class="customer-row ${customer.id === selectedCustomerId ? 'selected' : ''}" data-customer-id="${esc(customer.id)}" tabindex="0" role="button"><strong>${esc(customer.firstName)} ${esc(customer.lastName)}</strong><small>${esc(customer.id)} · ${esc(customer.email || customer.phone || 'No contact detail')}</small></div>`).join('') || '<p class="muted-copy">No matching customer profiles.</p>';
    $$('.customer-row').forEach((row) => {
      const open = () => { selectedCustomerId = row.dataset.customerId; renderCustomers(); };
      row.addEventListener('click', open); row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    renderCustomerProfile();
  }
  function renderCustomerProfile() {
    const panel = $('#customer-profile'); const customer = E.getCustomer(state, selectedCustomerId);
    if (!customer) { panel.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><h3>Select a customer</h3><p>Customer cases and interaction history will appear here.</p></div>'; return; }
    const cases = state.cases.filter((item) => item.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const timeline = E.getCustomerTimeline(state, customer.id).slice(0, 16);
    const initials = `${customer.firstName[0] || ''}${customer.lastName[0] || ''}`.toUpperCase();
    panel.innerHTML = `<div class="profile-hero"><div class="avatar">${esc(initials)}</div><div><h2>${esc(customer.preferredName || customer.firstName)} ${esc(customer.lastName)}</h2><p>${esc(customer.id)} · ${esc(customer.segment)} · ${esc(customer.status)}</p></div></div>
      <div class="profile-grid"><div><small>EMAIL</small><strong>${esc(customer.email || 'Not provided')}</strong></div><div><small>PHONE</small><strong>${esc(customer.phone || 'Not provided')}</strong></div><div><small>PREFERRED CHANNEL</small><strong>${esc(customer.preferredChannel)}</strong></div><div><small>LAST CONTACT</small><strong>${esc(fmtDate(customer.lastContactAt))}</strong></div></div>
      <div class="detail-section"><div class="section-title">LINKED PRODUCTS & SERVICES</div><div class="tag-list">${(customer.services || []).map((service) => `<span class="tag">${esc(productLabel(service))}</span>`).join('') || '<span class="muted-copy">No linked services</span>'}</div><div class="tag-list">${(customer.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div></div>
      <div class="detail-section"><div class="section-title">CONTACT PERMISSIONS</div><div class="profile-grid"><div><small>EMAIL</small><strong>${customer.consent && customer.consent.email ? 'Consented' : 'Not recorded'}</strong></div><div><small>SMS</small><strong>${customer.consent && customer.consent.sms ? 'Consented' : 'Not recorded'}</strong></div><div><small>MARKETING</small><strong>${customer.consent && customer.consent.marketing ? 'Separately consented' : 'Not consented'}</strong></div></div></div>
      <div class="detail-section"><div class="section-title">LINKED CASES · ${cases.length}</div>${cases.length ? cases.map((item) => `<div class="case-link" data-open-customer-case="${esc(item.id)}"><div><strong>${esc(item.reference)} · ${esc(item.subject)}</strong><br><small>${esc(item.status)} · ${esc(item.owner)}</small></div><span class="badge ${priorityClass(item.priority)}">${esc(item.priority)}</span></div>`).join('') : '<p class="muted-copy">No service cases for this customer.</p>'}</div>
      <div class="detail-section"><div class="section-title">ADD INTERNAL CUSTOMER NOTE</div><form id="customer-note-form" class="mini-form"><input class="field" name="note" required minlength="10" placeholder="Operational note (no passwords or secrets)"><input class="field" name="author" placeholder="Author" value="Customer Care"><button class="button secondary" type="submit">Add note</button></form></div>
      <div class="detail-section"><div class="section-title">CUSTOMER JOURNEY TIMELINE</div><div class="timeline">${timeline.map((event) => `<div class="timeline-item"><i class="timeline-dot"></i><div><strong>${esc(event.title)}</strong><p>${esc(event.detail)}</p><time>${esc(fmtDate(event.at))}</time></div></div>`).join('') || '<p class="muted-copy">No recorded customer activity.</p>'}</div></div>`;
    $$('[data-open-customer-case]').forEach((node) => node.addEventListener('click', () => { selectedCaseId = node.dataset.openCustomerCase; setView('queue'); }));
    $('#customer-note-form').addEventListener('submit', (event) => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      try { E.addCustomerNote(state, customer.id, values.note, values.author, new Date()); persist(); renderCustomers(); notify('Internal customer note saved.'); }
      catch (error) { notify(error.message, true); }
    });
  }
  function populateSelect(node, values, label) {
    node.innerHTML = `${label ? `<option value="">${esc(label)}</option>` : ''}${values.map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('')}`;
  }
  function populateCreateForm() {
    const customerOptions = state.customers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} · ${c.id}` }));
    populateSelect($('#create-customer'), customerOptions, 'Choose customer');
    populateSelect($('#incident-customer'), customerOptions, 'Choose customer profile');
    populateSelect($('[name="productId"]'), E.PRODUCTS.map((p) => ({ value: p.id, label: p.name })));
    populateSelect($('[name="category"]'), E.CATEGORIES.map((x) => ({ value: x, label: x })));
    populateSelect($('[name="priority"]'), E.PRIORITIES.map((x) => ({ value: x, label: x })));
    populateSelect($('[name="channel"]'), E.CHANNELS.map((x) => ({ value: x, label: x })));
    if (selectedCustomerId) $('#create-customer').value = selectedCustomerId;
    const incidents = E.readLinkedIncidents(window.localStorage, new Date());
    populateSelect($('#incident-select'), incidents.map((item) => ({ value: item.id, label: `${item.reference} · ${item.title} (${item.status})` })), incidents.length ? 'Choose open incident' : 'No open incidents detected');
    $('#incident-bridge-count').textContent = String(incidents.length);
  }
  function createCaseFromForm(event) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    values.customerId = $('#create-customer').value; values.tags = values.tags ? values.tags.split(',').map((x) => x.trim()).filter(Boolean) : [];
    try {
      const item = E.createCase(state, values, new Date()); selectedCaseId = item.id; selectedCustomerId = item.customerId; persist(); form.reset(); $('#create-feedback').textContent = `${item.reference} created. Owner: ${item.owner}.`;
      populateCreateForm(); notify(`Case ${item.reference} created.`); setView('queue');
    } catch (error) { $('#create-feedback').textContent = error.message; $('#create-feedback').style.color = 'var(--red)'; }
  }
  function createLinkedIncidentCase() {
    const incidentId = $('#incident-select').value; const customerId = $('#incident-customer').value;
    const incident = E.readLinkedIncidents(window.localStorage, new Date()).find((item) => item.id === incidentId);
    try {
      if (!incident) throw new Error('Choose an available incident from the v5.3 register.');
      const item = E.createCaseFromIncident(state, incident, customerId, $('#incident-owner').value, new Date());
      selectedCaseId = item.id; selectedCustomerId = item.customerId; persist(); $('#incident-feedback').textContent = `${item.reference} linked to ${incident.reference}.`;
      notify('Customer-impact case created from the service incident.'); setView('queue');
    } catch (error) { $('#incident-feedback').textContent = error.message; $('#incident-feedback').style.color = 'var(--red)'; }
  }
  function openCustomerDialog() {
    const dialog = $('#customer-dialog'); const form = $('#create-customer-form');
    populateSelect($('[name="preferredChannel"]', form), E.CHANNELS.map((x) => ({ value: x, label: x })));
    populateSelect($('[name="services"]', form), E.PRODUCTS.map((x) => ({ value: x.id, label: x.name })));
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function createCustomerFromForm(event) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries());
    const selectedServices = $$('[name="services"] option:checked', form).map((option) => option.value);
    try {
      const customer = E.createCustomer(state, { ...data, services: selectedServices, consent: { email: $('[name="consentEmail"]', form).checked, sms: $('[name="consentSms"]', form).checked, marketing: $('[name="consentMarketing"]', form).checked } }, new Date());
      selectedCustomerId = customer.id; persist(); form.reset(); $('#customer-dialog').close(); setView('customers'); $('#customer-search').value = ''; renderCustomers(); notify(`Customer profile ${customer.id} created.`);
    } catch (error) { $('#customer-create-feedback').textContent = error.message; $('#customer-create-feedback').style.color = 'var(--red)'; }
  }
  function renderReports() {
    const m = E.getMetrics(state, new Date());
    const stats = [['Total customer profiles', m.customers], ['Total service cases', m.totalCases], ['Active workload', m.activeCases], ['SLA breaches', m.breached]];
    $('#report-grid').innerHTML = stats.map(([label, value]) => `<div class="metric-card ${label === 'SLA breaches' && value ? 'alert' : ''}"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value}</div></div>`).join('');
    const counts = E.PRODUCTS.map((product) => ({ name: product.name, count: state.cases.filter((item) => item.productId === product.id).length }));
    const max = Math.max(1, ...counts.map((item) => item.count));
    $('#product-breakdown').innerHTML = counts.filter((item) => item.count).sort((a, b) => b.count - a.count).map((item) => `<div class="breakdown-row"><span>${esc(item.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${item.count / max * 100}%"></div></div><strong>${item.count}</strong></div>`).join('') || '<p class="muted-copy">No case data.</p>';
    $('#activity-list').innerHTML = state.activity.slice(0, 25).map((item) => `<div class="activity-row"><p>${esc(item.message)}</p><time>${esc(fmtDate(item.at))}</time></div>`).join('') || '<p class="muted-copy">No activity recorded.</p>';
  }
  function downloadCsv() {
    const blob = new Blob([E.exportCasesCsv(state)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `calloria-cases-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
  function renderAll() { renderMetrics(); renderQueue(); renderCustomers(); renderReports(); }

  $$('.nav-button').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
  $('#case-search').addEventListener('input', renderQueue); $('#filter-status').addEventListener('change', renderQueue); $('#filter-priority').addEventListener('change', renderQueue);
  $('#case-list').addEventListener('click', (event) => { const row = event.target.closest('[data-case-id]'); if (!row) return; selectedCaseId = row.dataset.caseId; renderQueue(); });
  $('#case-list').addEventListener('keydown', (event) => { const row = event.target.closest('[data-case-id]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectedCaseId = row.dataset.caseId; renderQueue(); } });
  $('#customer-search').addEventListener('input', renderCustomers);
  $('#create-case-form').addEventListener('submit', createCaseFromForm);
  $('#create-incident-case').addEventListener('click', createLinkedIncidentCase);
  $('#open-customer-modal').addEventListener('click', openCustomerDialog);
  $('#close-customer-modal').addEventListener('click', () => $('#customer-dialog').close());
  $('#create-customer-form').addEventListener('submit', createCustomerFromForm);
  $('#export-cases').addEventListener('click', downloadCsv);
  window.addEventListener('storage', (event) => {
    if (event.key === E.RELIABILITY_KEY || event.key === E.KNOWLEDGE_KEY) notify('A connected module changed. Imported suggestions refresh when you reopen this page.');
  });
  populateCreateForm(); renderAll();
})();
