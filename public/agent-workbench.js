(function () {
  'use strict';
  const E = window.CalloriaAgentWorkbenchEngine;
  const C = window.CalloriaCustomerJourneyEngine;
  if (!E || !C) {
    document.body.innerHTML = '<main style="max-width:720px;margin:60px auto;padding:24px;font:16px system-ui"><h1>CALLORIA Agent Workbench could not start</h1><p>Install the Customer 360 & Case Management v5.4 module first. The agent desk uses its customer and case engine to keep contact records connected to customer history.</p></main>';
    return;
  }
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const storage = window.localStorage;
  let state = E.load(storage);
  let selectedContactId = null;
  let toastTimer = null;
  let knowledgeQuery = '';
  let selectedKnowledgeIds = new Set();
  let previewOnly = false;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }
  function timeSince(value) {
    if (!value) return '—';
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    return minutes < 1 ? 'Just now' : `${minutes}m waiting`;
  }
  function productLabel(id) { return (E.PRODUCTS.find((item) => item.id === id) || E.PRODUCTS[0]).name; }
  function priorityClass(priority) { return priority.startsWith('P1') ? 'p1' : priority.startsWith('P2') ? 'p2' : priority.startsWith('P3') ? 'p3' : 'p4'; }
  function persist() {
    const ok = E.save(state, storage);
    if (!ok) throw new Error('Could not save the workbench to browser storage. Check available browser storage and try again.');
  }
  function notify(message, isError = false) {
    const node = $('#toast'); node.textContent = message; node.className = `toast visible${isError ? ' error' : ''}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.className = 'toast'; }, 2600);
  }
  function customerState() { return C.load(storage); }
  function customerFor(contact) { return contact ? C.getCustomer(customerState(), contact.customerId) : null; }
  function currentContact() { return E.getActiveContact(state); }
  function selectedContact() { return E.getContact(state, selectedContactId); }
  function fillSelect(node, values, label) {
    node.innerHTML = `${label ? `<option value="">${esc(label)}</option>` : ''}${values.map((value) => `<option value="${esc(value.value)}">${esc(value.label)}</option>`).join('')}`;
  }
  function updateShiftControls() {
    const onShift = E.isOnShift(state);
    $('#shift-state').textContent = onShift ? state.agent.presence.toUpperCase() : 'OFF SHIFT';
    $('#shift-state').className = `presence-chip ${onShift ? state.agent.presence.toLowerCase() : 'offline'}`;
    $('#agent-name').value = state.agent.name;
    $('#agent-team').value = state.agent.team;
    $('#start-shift').disabled = onShift;
    $('#end-shift').disabled = !onShift || !!state.activeContactId;
    $('#presence-select').disabled = !onShift;
    $('#presence-select').value = state.agent.presence;
  }
  function renderMetrics() {
    const metrics = E.getMetrics(state);
    $('#metric-queued').textContent = String(metrics.queued);
    $('#metric-handled').textContent = String(metrics.handled);
    $('#metric-transferred').textContent = String(metrics.transferred);
    $('#metric-aht').textContent = `${metrics.averageHandleMinutes}m`;
    $('#metric-replies').textContent = String(metrics.replyCount);
    $('#queue-count').textContent = String(metrics.queued);
  }
  function renderQueue() {
    const channel = $('#queue-channel').value;
    const query = $('#queue-search').value;
    const contacts = E.queuedContacts(state, { channel, query });
    $('#queue-list').innerHTML = contacts.map((contact) => `
      <article class="queue-item ${selectedContactId === contact.id ? 'selected' : ''}" data-queue-contact="${esc(contact.id)}" tabindex="0" role="button" aria-label="Open ${esc(contact.reference)}">
        <div class="queue-top"><strong>${esc(contact.subject)}</strong><span class="priority ${priorityClass(contact.priority)}">${esc(contact.priority.slice(0, 2))}</span></div>
        <p>${esc(contact.message.slice(0, 104))}${contact.message.length > 104 ? '…' : ''}</p>
        <div class="queue-bottom"><span class="channel-label">${esc(contact.channel)} · ${esc(contact.customerId)}</span><span class="queue-meta">${esc(timeSince(contact.createdAt))}</span></div>
      </article>`).join('') || '<div class="empty-state">No queued contacts match this filter. Change the channel or search term.</div>';
    $$('[data-queue-contact]').forEach((row) => {
      const choose = () => { selectedContactId = row.dataset.queueContact; previewOnly = true; renderQueue(); renderContactDetail(); renderCustomerContext(); };
      row.addEventListener('click', choose);
      row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
    });
    renderMetrics();
  }
  function renderContactDetail() {
    const panel = $('#contact-detail');
    const active = currentContact();
    const contact = active || selectedContact();
    if (!contact) {
      panel.className = 'contact-empty';
      panel.innerHTML = '<div class="empty-symbol">↗</div><h2>Choose a queued contact</h2><p>Start your shift, then accept an inbound contact to open the interaction workspace.</p><span>Voice · Email · Live chat · Social · SMS · In-app</span>';
      return;
    }
    const isActive = !!active && active.id === contact.id;
    const messages = contact.messages.map((message) => `<div class="message ${message.direction === 'Outbound' ? 'outbound' : 'inbound'}"><div class="message-head"><span>${esc(message.author)}</span><time>${esc(formatDate(message.at))}</time></div>${esc(message.body)}</div>`).join('');
    const notes = (contact.internalNotes || []).map((note) => `<div class="message inbound"><div class="message-head"><span>INTERNAL NOTE · ${esc(note.author)}</span><time>${esc(formatDate(note.at))}</time></div>${esc(note.text)}</div>`).join('');
    const isQueued = contact.status === 'Queued';
    panel.className = 'contact-active';
    panel.innerHTML = `
      <div class="contact-title">
        <div class="contact-title-top"><div><div class="eyebrow">${esc(contact.reference)} · ${esc(contact.channel.toUpperCase())} · ${esc(contact.status.toUpperCase())}</div><h2>${esc(contact.subject)}</h2><div class="contact-subtitle"><span>${esc(productLabel(contact.productId))}</span><span>Customer ${esc(contact.customerId)}</span><span>Received ${esc(formatDate(contact.createdAt))}</span><span class="priority ${priorityClass(contact.priority)}">${esc(contact.priority)}</span></div></div>
        <div class="contact-controls">${isQueued ? '<button id="accept-contact" class="button button-primary">Accept contact</button>' : ''}${isActive ? '<button id="open-wrap" class="button button-primary">Wrap up</button><button id="toggle-transfer" class="button button-danger">Transfer</button>' : ''}</div></div>
        ${isQueued && !E.isOnShift(state) ? '<p class="form-feedback">Start your shift before accepting this contact.</p>' : ''}
      </div>
      <div id="conversation" class="conversation">${messages || '<p class="empty-state">No messages recorded.</p>'}</div>
      <div class="conversation-tools"><span>${contact.replyCount || 0} agent replies · ${contact.messages.length} transcript entries</span><span>${isActive ? 'ACTIVE CONTACT' : 'QUEUE PREVIEW — READ ONLY'}</span></div>
      <div class="agent-coach-hint"><strong>CONTACT HANDLING CUE</strong><span>${esc(contact.replyHint || 'Clarify the request, explain the next action and record the outcome.')}</span></div>
      ${isActive ? `<div class="composer"><label class="form-label" for="reply-text">Customer response <span class="muted-copy">· ${esc(contact.channel)} simulation</span></label><textarea id="reply-text" maxlength="2000" placeholder="Write a clear response. Never request a password or one-time code."></textarea><div class="composer-actions"><small>Responses are simulated and saved in this browser.</small><div class="composer-buttons"><button id="add-note" class="button button-secondary">Internal note</button><button id="send-reply" class="button button-primary">Send response</button></div></div></div><div id="transfer-box" class="composer hidden"><label class="form-label">Receiving team<select id="transfer-team"><option>Technical Support</option><option>Digital Support</option><option>Player Support</option><option>Service Recovery</option><option>Quality Assurance</option><option>Sales & Service</option><option>Workforce Management</option></select></label><label class="form-label">Transfer reason<textarea id="transfer-reason" minlength="10" rows="2" placeholder="Explain the specialist assistance needed."></textarea></label><button id="confirm-transfer" class="button button-danger">Confirm transfer</button></div>` : ''}
    `;
    $('#conversation').scrollTop = $('#conversation').scrollHeight;
    if (isQueued) $('#accept-contact').addEventListener('click', acceptSelectedContact);
    if (isActive) {
      $('#send-reply').addEventListener('click', sendActiveReply);
      $('#add-note').addEventListener('click', addActiveNote);
      $('#open-wrap').addEventListener('click', openWrapDialog);
      $('#toggle-transfer').addEventListener('click', () => $('#transfer-box').classList.toggle('hidden'));
      $('#confirm-transfer').addEventListener('click', confirmTransfer);
    }
  }
  function renderCustomerContext() {
    const contact = currentContact() || selectedContact();
    const panel = $('#customer-context');
    if (!contact) { $('#customer-link-state').textContent = 'NOT LINKED'; panel.innerHTML = '<div class="empty-state">Accept a contact to load the linked customer profile.</div>'; return; }
    const db = customerState(); const customer = C.getCustomer(db, contact.customerId);
    if (!customer) { $('#customer-link-state').textContent = 'PROFILE MISSING'; panel.innerHTML = '<div class="empty-state">No matching v5.4 customer profile. Do not create a duplicate profile from an unverified contact.</div>'; return; }
    const cases = db.cases.filter((item) => item.customerId === customer.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const initials = `${customer.firstName[0] || ''}${customer.lastName[0] || ''}`.toUpperCase();
    $('#customer-link-state').textContent = 'V5.4 LINKED';
    panel.innerHTML = `
      <div class="customer-head"><div class="avatar">${esc(initials)}</div><div><strong>${esc(customer.preferredName || customer.firstName)} ${esc(customer.lastName)}</strong><small>${esc(customer.id)} · ${esc(customer.segment || 'Customer')}</small></div></div>
      <div class="customer-fields"><div><span>EMAIL</span><strong>${esc(customer.email || 'Not provided')}</strong></div><div><span>PHONE</span><strong>${esc(customer.phone || 'Not provided')}</strong></div><div><span>PREFERRED CHANNEL</span><strong>${esc(customer.preferredChannel || 'Not set')}</strong></div><div><span>LAST CONTACT</span><strong>${esc(formatDate(customer.lastContactAt))}</strong></div></div>
      <div class="rail-section"><div class="rail-section-title">CONTACT PERMISSIONS</div><span class="permission-tag ${customer.consent && customer.consent.email ? 'yes' : ''}">Email ${customer.consent && customer.consent.email ? 'recorded' : 'not recorded'}</span><span class="permission-tag ${customer.consent && customer.consent.sms ? 'yes' : ''}">SMS ${customer.consent && customer.consent.sms ? 'recorded' : 'not recorded'}</span><span class="permission-tag ${customer.consent && customer.consent.marketing ? 'yes' : ''}">Marketing ${customer.consent && customer.consent.marketing ? 'consented' : 'not consented'}</span></div>
      <div class="rail-section"><div class="rail-section-title">OPEN CUSTOMER CASES · ${cases.filter((item) => !['Resolved', 'Closed'].includes(item.status)).length}</div>${cases.filter((item) => !['Resolved', 'Closed'].includes(item.status)).slice(0, 4).map((item) => `<div class="case-chip"><strong>${esc(item.reference)} · ${esc(item.subject)}</strong><span>${esc(item.status)} · ${esc(item.priority)} · ${esc(item.owner)}</span></div>`).join('') || '<div class="empty-state">No open case recorded.</div>'}</div>`;
  }
  function renderKnowledge() {
    const contact = currentContact() || selectedContact();
    const results = E.searchKnowledge(storage, knowledgeQuery || '', contact ? contact.productId : 'all', new Date());
    const panel = $('#knowledge-results');
    if (!results.length) { panel.innerHTML = '<div class="empty-state">No published, unexpired article matched. Do not treat drafts or expired guidance as approved.</div>'; return; }
    const selected = new Set(contact && Array.isArray(contact.knowledgeReferences) ? contact.knowledgeReferences : []);
    panel.innerHTML = results.map((article) => `<article class="article-card"><strong>${esc(article.title)}</strong><p>${esc(article.summary)}</p><small class="queue-meta">${esc(article.category)} · v${Number(article.version) || 1}</small>${article.steps && article.steps.length ? `<details class="article-steps"><summary>View approved steps</summary><ol>${article.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol></details>` : ''}<div><button class="button button-secondary" data-use-article="${esc(article.id)}">${selected.has(article.id) ? 'Added to contact' : 'Use in case'}</button></div></article>`).join('');
    $$('[data-use-article]').forEach((button) => button.addEventListener('click', () => {
      const active = currentContact(); if (!active) { notify('Accept the contact before adding knowledge references.', true); return; }
      const articleId = button.dataset.useArticle;
      active.knowledgeReferences = Array.isArray(active.knowledgeReferences) ? active.knowledgeReferences : [];
      if (active.knowledgeReferences.includes(articleId)) active.knowledgeReferences = active.knowledgeReferences.filter((id) => id !== articleId);
      else active.knowledgeReferences.push(articleId);
      persist(); renderKnowledge(); notify(active.knowledgeReferences.includes(articleId) ? 'Knowledge article attached to this contact.' : 'Knowledge article removed from this contact.');
    }));
  }
  function renderServiceAwareness() {
    const knowledgeRaw = safeJson(storage.getItem(E.KNOWLEDGE_KEY));
    const today = new Date().toISOString().slice(0, 10);
    const notices = knowledgeRaw && Array.isArray(knowledgeRaw.notices) ? knowledgeRaw.notices.filter((item) => item && item.status === 'Published' && (!item.effectiveAt || item.effectiveAt <= today)) : [];
    const noticeStrip = $('#notice-strip');
    noticeStrip.innerHTML = notices.slice(0, 3).map((item) => `<div class="notice-item ${String(item.severity || item.priority || '').toLowerCase().includes('critical') ? 'critical' : ''}"><strong>${esc(item.title || item.subject || 'Service notice')}</strong> · ${esc(item.summary || item.message || item.body || 'Published guidance notice is available in Knowledge Operations.')}</div>`).join('');
    const reliability = safeJson(storage.getItem(E.RELIABILITY_KEY));
    const incidents = reliability && Array.isArray(reliability.incidents) ? reliability.incidents.filter((item) => item && !['Closed'].includes(item.status)) : [];
    $('#incident-count').textContent = String(incidents.length);
    $('#incident-context').innerHTML = incidents.slice(0, 4).map((item) => `<div class="incident-card"><strong>${esc(item.reference || item.id)} · ${esc(item.title)}</strong><p>${esc(item.status)} · ${esc(item.severity)} · ${esc(item.impact || item.summary || 'Impact details not recorded.')}</p></div>`).join('') || '<div class="empty-state">No active incidents in the v5.3 register.</div>';
  }
  function safeJson(value) { try { return value ? JSON.parse(value) : null; } catch (_) { return null; } }
  function renderCompleted() {
    const rows = state.contacts.filter((item) => ['Completed', 'Transferred', 'Missed'].includes(item.status)).sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || ''))).slice(0, 12);
    $('#completed-rows').innerHTML = rows.map((item) => `<tr><td><strong>${esc(item.reference)}</strong></td><td>${esc(item.channel)}</td><td>${esc(item.customerId)}</td><td>${esc(item.disposition || item.status)}</td><td>${esc(item.wrapUp && item.wrapUp.linkedCaseId || item.linkedCaseId || '—')}</td><td>${esc(formatDate(item.completedAt))}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">No completed contacts in this workbench yet.</td></tr>';
  }
  function renderAll() {
    updateShiftControls(); renderMetrics(); renderQueue(); renderContactDetail(); renderCustomerContext(); renderKnowledge(); renderServiceAwareness(); renderCompleted();
  }
  function acceptSelectedContact() {
    const contact = selectedContact();
    try {
      if (!contact) throw new Error('Choose a queued contact first.');
      E.acceptContact(state, contact.id, new Date()); selectedContactId = contact.id; previewOnly = false; persist(); renderAll(); notify(`${contact.reference} accepted.`);
    } catch (error) { notify(error.message, true); }
  }
  function sendActiveReply() {
    const contact = currentContact(); if (!contact) return;
    try {
      const now = new Date();
      E.sendReply(state, contact.id, $('#reply-text').value, now);
      const customerTurn = E.simulateCustomerResponse(state, contact.id, now);
      persist(); renderAll(); notify(customerTurn ? 'Response saved. A scripted customer reply was added.' : 'Response saved to the simulated transcript.');
    } catch (error) { notify(error.message, true); }
  }
  function addActiveNote() {
    const contact = currentContact(); if (!contact) return;
    const text = window.prompt('Internal note. Do not enter passwords, one-time codes or payment secrets.');
    if (text == null) return;
    try { E.addInternalNote(state, contact.id, text, new Date()); persist(); renderAll(); notify('Internal note saved.'); }
    catch (error) { notify(error.message, true); }
  }
  function confirmTransfer() {
    const contact = currentContact(); if (!contact) return;
    try {
      const team = $('#transfer-team').value, reason = $('#transfer-reason').value;
      E.transferContact(state, contact.id, team, reason, new Date()); persist(); selectedContactId = null; renderAll(); notify(`Contact transferred to ${team}.`);
    } catch (error) { notify(error.message, true); }
  }
  function openWrapDialog() {
    const contact = currentContact(); if (!contact) return;
    const dialog = $('#wrap-dialog'); const db = customerState();
    const options = db.cases.filter((item) => item.customerId === contact.customerId && !['Resolved', 'Closed'].includes(item.status)).map((item) => ({ value: item.id, label: `${item.reference} · ${item.subject} (${item.status})` }));
    fillSelect($('#wrap-disposition'), E.DISPOSITIONS.map((item) => ({ value: item, label: item })));
    fillSelect($('#case-priority'), E.PRIORITIES.map((item) => ({ value: item, label: item })));
    fillSelect($('#case-category'), E.CATEGORIES.map((item) => ({ value: item, label: item })));
    fillSelect($('#existing-case'), options, options.length ? 'Choose open case' : 'No open customer cases');
    $('#wrap-reference').textContent = `${contact.reference} · ${contact.channel} · ${contact.subject}`;
    $('#wrap-summary').value = '';
    $('#case-subject').value = contact.subject;
    $('#case-priority').value = contact.priority;
    $('#case-action').value = options.length ? 'existing' : 'create';
    $('#wrap-feedback').textContent = '';
    updateCaseActionFields();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function updateCaseActionFields() {
    const action = $('#case-action').value;
    $('#existing-case-wrap').classList.toggle('hidden', action !== 'existing');
    $('#new-case-wrap').classList.toggle('hidden', action !== 'create');
    $('#case-priority').disabled = action === 'existing' || action === 'note-only';
  }
  function syncContactToCustomerJourney(contact, input, now) {
    return E.commitToCustomerJourney(state, contact.id, input, C, storage, now);
  }
  function submitWrapUp(event) {
    event.preventDefault();
    const contact = currentContact(); if (!contact) return;
    const input = {
      disposition: $('#wrap-disposition').value,
      summary: $('#wrap-summary').value,
      caseAction: $('#case-action').value,
      existingCaseId: $('#existing-case').value,
      category: $('#case-category').value,
      priority: $('#case-priority').value,
      caseSubject: $('#case-subject').value
    };
    try {
      if (input.disposition === 'Case created' && input.caseAction !== 'create' && input.caseAction !== 'existing') throw new Error('This disposition requires a linked case.');
      const now = new Date();
      const linkedCase = syncContactToCustomerJourney(contact, input, now);
      E.completeContact(state, contact.id, { ...input, linkedCaseId: linkedCase ? linkedCase.id : null }, now);
      persist(); $('#wrap-dialog').close(); selectedContactId = null; renderAll(); notify(`${contact.reference} completed and recorded in Customer 360.`);
    } catch (error) { $('#wrap-feedback').textContent = error.message; }
  }
  function downloadCsv() {
    const csv = E.exportInteractionsCsv(state);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'calloria-agent-contact-log.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  $('#start-shift').addEventListener('click', () => {
    try { E.startShift(state, $('#agent-name').value, $('#agent-team').value, new Date()); persist(); renderAll(); notify('Agent shift started. Presence is Available.'); }
    catch (error) { notify(error.message, true); }
  });
  $('#end-shift').addEventListener('click', () => {
    try { E.endShift(state, new Date()); persist(); renderAll(); notify('Agent shift ended.'); }
    catch (error) { notify(error.message, true); }
  });
  $('#presence-select').addEventListener('change', () => {
    try { E.setPresence(state, $('#presence-select').value, new Date()); persist(); renderAll(); notify(`Presence set to ${state.agent.presence}.`); }
    catch (error) { notify(error.message, true); renderAll(); }
  });
  $('#queue-search').addEventListener('input', renderQueue);
  $('#queue-channel').addEventListener('change', renderQueue);
  $('#knowledge-search').addEventListener('input', () => { knowledgeQuery = $('#knowledge-search').value; renderKnowledge(); });
  $('#knowledge-search-button').addEventListener('click', () => { knowledgeQuery = $('#knowledge-search').value; renderKnowledge(); });
  $('#case-action').addEventListener('change', updateCaseActionFields);
  $('#wrap-form').addEventListener('submit', submitWrapUp);
  $('#close-wrap').addEventListener('click', () => $('#wrap-dialog').close());
  $('#cancel-wrap').addEventListener('click', () => $('#wrap-dialog').close());
  $('#export-csv').addEventListener('click', downloadCsv);
  if (!storage.getItem(E.STORAGE_KEY)) persist();
  renderAll();
  window.CalloriaAgentWorkbench = { getState: () => state, render: renderAll, engine: E };
})();
