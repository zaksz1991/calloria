(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const E = window.CalloriaAgentWorkbenchEngine;
  const C = window.CalloriaCustomerJourneyEngine;
  const F = window.CalloriaLiveFloorEngine;
  const realStorage = window.localStorage;
  const toast = $('#toast');
  let toastTimer = null;
  let selectedChannel = '';
  let articleQuery = '';

  if (!E || !C || !F) {
    document.body.innerHTML = '<main style="max-width:700px;margin:60px auto;padding:24px;font:14px system-ui"><h1>CALLORIA Live Floor could not start</h1><p>Required simulation engine files are missing. Copy the complete v6.0 package into the public folder and reload this page.</p></main>';
    return;
  }

  const storageProxy = {
    getItem(key) { return key === E.STORAGE_KEY ? realStorage.getItem(F.AGENT_STORAGE_KEY) : realStorage.getItem(key); },
    setItem(key, value) { return key === E.STORAGE_KEY ? realStorage.setItem(F.AGENT_STORAGE_KEY, value) : realStorage.setItem(key, value); },
    removeItem(key) { return key === E.STORAGE_KEY ? realStorage.removeItem(F.AGENT_STORAGE_KEY) : realStorage.removeItem(key); }
  };

  let state = F.load(realStorage);
  let agentState = E.load(storageProxy);
  E.save(agentState, storageProxy);
  F.save(state, realStorage);

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function notify(message, error) {
    toast.textContent = message;
    toast.classList.toggle('error', !!error);
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }
  function persist() {
    const agentSaved = E.save(agentState, storageProxy);
    const floorSaved = F.save(state, realStorage);
    if (!agentSaved || !floorSaved) notify('Browser storage could not save the current shift. Check available site storage.', true);
  }
  function productLabel(productId) {
    return (E.PRODUCTS.find((item) => item.id === productId) || E.PRODUCTS[0]).name;
  }
  function priorityClass(priority) {
    if (String(priority).startsWith('P1')) return 'p1';
    if (String(priority).startsWith('P2')) return 'p2';
    if (String(priority).startsWith('P3')) return 'p3';
    return 'p4';
  }
  function getQueue() {
    return E.queuedContacts(agentState, selectedChannel ? { channel: selectedChannel } : {});
  }
  function openCasesForCustomer(customerId) {
    const db = C.load(realStorage);
    return (db.cases || []).filter((item) => item.customerId === customerId && !['Resolved', 'Closed'].includes(item.status));
  }
  function renderMetrics() {
    const count = state.metrics.completed;
    $('#metric-handled').textContent = String(count);
    $('#metric-qa').textContent = count ? `${Math.round(state.metrics.qaTotal / count)}%` : '—';
    $('#metric-csat').textContent = count ? `${(state.metrics.csatTotal / count).toFixed(1)} / 5` : '—';
    $('#metric-fcr').textContent = count ? `${Math.round(state.metrics.fcr / count * 100)}%` : '—';
    $('#metric-breaches').textContent = String(state.metrics.complianceBreaches);
    $('#metric-knowledge').textContent = String(state.metrics.knowledgeUses);
  }
  function renderClockAndStatus() {
    $('#shift-clock').textContent = F.clockLabel(state.shift.minutes);
    $('#shift-status').textContent = state.shift.status.toUpperCase();
    const onShift = F.isOnShift(state);
    $('#start-panel').classList.toggle('hidden', onShift);
    $('#end-shift').disabled = !onShift || !!state.active;
    const status = $('#work-status');
    status.textContent = state.active ? 'CUSTOMER ACTIVE' : onShift ? (F.dueEvent(state) ? 'FLOOR EVENT DUE' : 'AVAILABLE') : state.shift.status.toUpperCase();
    status.className = `status-tag${state.active ? ' active' : onShift ? ' ready' : ''}`;
    $('#work-title').textContent = state.active ? 'Customer interaction in progress' : onShift ? 'Customer desk ready' : state.shift.status === 'Ended' ? 'Shift complete' : 'Ready for your shift';
    $('#work-empty').classList.toggle('hidden', !!state.active);
    $('#active-work').classList.toggle('hidden', !state.active);
    if (!state.active) {
      if (state.shift.status === 'Ended') {
        $('#work-empty-title').textContent = 'Shift complete';
        $('#work-empty-copy').textContent = 'Your shift report is available below. Start another shift to run a fresh customer queue.';
      } else if (onShift && F.dueEvent(state)) {
        $('#work-empty-title').textContent = 'Scheduled floor event';
        $('#work-empty-copy').textContent = `Complete the ${F.dueEvent(state).title.toLowerCase()} shown above before accepting the next customer.`;
      } else if (onShift) {
        $('#work-empty-title').textContent = 'Your customer desk is ready';
        $('#work-empty-copy').textContent = 'Select the next queued customer on the left. Each interaction has three service decisions and a required wrap-up.';
      } else {
        $('#work-empty-title').textContent = 'Your customer desk is waiting';
        $('#work-empty-copy').textContent = 'Start the shift and attend the 7:30 AM briefing. Your customer queue and workstation will unlock after sign-in.';
      }
    }
  }
  function renderQueue() {
    const queue = getQueue();
    const due = F.dueEvent(state);
    const blocked = !F.isOnShift(state) || !!due || !!state.active;
    $('#queue-count').textContent = String(queue.length);
    const list = $('#queue-list');
    if (!queue.length) {
      list.innerHTML = `<div class="empty-note">${F.isOnShift(state) ? 'No queued contacts remain. End the shift when floor events are complete.' : 'Sign in to load your shift queue.'}</div>`;
      return;
    }
    list.innerHTML = queue.map((contact) => `
      <button type="button" class="queue-item" data-contact-id="${escapeHtml(contact.id)}" ${blocked ? 'disabled' : ''}>
        <span class="queue-line"><strong>${escapeHtml(contact.reference)}</strong><span class="priority-chip ${priorityClass(contact.priority)}">${escapeHtml(contact.priority.split(' - ')[0])}</span></span>
        <p>${escapeHtml(contact.subject)}</p>
        <span class="queue-meta"><span>${escapeHtml(contact.channel)} · ${escapeHtml(productLabel(contact.productId))}</span><span>${escapeHtml(contact.customerTone || 'Customer')}</span></span>
      </button>`).join('');
    list.querySelectorAll('[data-contact-id]').forEach((button) => button.addEventListener('click', () => acceptContact(button.dataset.contactId)));
  }
  function renderEvent() {
    const due = F.dueEvent(state);
    const panel = $('#event-panel');
    panel.classList.toggle('hidden', !due);
    if (!due) return;
    const copy = due.id === 'morningBriefing'
      ? 'Today’s focus: verify customers safely, check existing cases before opening duplicates, use approved product guidance and record clear next steps. Every department contributes to customer care.'
      : due.id === 'afternoonBriefing'
        ? 'Afternoon update: confirm outstanding customer commitments, review service-impact notices, name each handover owner and record the next update before leaving a case pending.'
        : due.description;
    $('#event-time').textContent = `${due.time} · ${due.type === 'briefing' ? 'TEAM BRIEFING' : 'SCHEDULED BREAK'}`;
    $('#event-title').textContent = due.title;
    $('#event-description').textContent = copy;
    $('#event-icon').textContent = due.type === 'briefing' ? 'B' : 'Ⅱ';
    $('#complete-event').textContent = due.type === 'briefing' ? 'Attend briefing' : `Take ${due.duration}-minute break`;
  }
  function renderRoutine() {
    const mapping = [
      ['routine-morning', 'morningBriefing'],
      ['routine-break', 'morningBreak'],
      ['routine-lunch', 'lunchBreak'],
      ['routine-afternoon', 'afternoonBriefing']
    ];
    mapping.forEach(([id, key]) => {
      const node = document.getElementById(id);
      const done = state.events[key];
      node.textContent = done ? 'DONE' : F.isOnShift(state) && F.dueEvent(state) && F.dueEvent(state).id === key ? 'DUE' : 'UPCOMING';
      node.classList.toggle('done', !!done);
    });
  }
  function customerName(customer) {
    return customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : 'Customer profile unavailable';
  }
  function renderCustomer(contact) {
    const db = C.load(realStorage);
    const customer = C.getCustomer(db, contact.customerId);
    const cases = openCasesForCustomer(contact.customerId);
    if (!customer) {
      $('#customer-card').innerHTML = '<div class="empty-note">No matching customer profile is available.</div>';
      return;
    }
    const initials = `${customer.firstName?.[0] || ''}${customer.lastName?.[0] || ''}`.toUpperCase();
    $('#customer-card').innerHTML = `
      <div class="customer-head"><span class="avatar">${escapeHtml(initials)}</span><div><strong>${escapeHtml(customerName(customer))}</strong><small>${escapeHtml(customer.segment || 'Customer')} · ${escapeHtml(customer.id)}</small></div></div>
      <div class="customer-fields">
        <div><span>EMAIL</span><strong>${escapeHtml(customer.email || 'Not recorded')}</strong></div>
        <div><span>PHONE</span><strong>${escapeHtml(customer.phone || 'Not recorded')}</strong></div>
        <div><span>PREFERRED CHANNEL</span><strong>${escapeHtml(customer.preferredChannel || 'Not set')}</strong></div>
        <div><span>PRODUCT</span><strong>${escapeHtml(productLabel(contact.productId))}</strong></div>
      </div>
      <div class="case-list"><strong>OPEN CUSTOMER CASES (${cases.length})</strong>${cases.length ? cases.slice(0, 3).map((item) => `<div class="case-item"><b>${escapeHtml(item.reference)} · ${escapeHtml(item.status)}</b>${escapeHtml(item.subject)}</div>`).join('') : '<div class="empty-note">No open case on this customer record.</div>'}</div>`;
  }
  function renderKnowledge(contact) {
    const results = E.searchKnowledge(realStorage, articleQuery, contact ? contact.productId : 'all', new Date());
    const list = $('#knowledge-list');
    if (!contact) {
      list.innerHTML = '<div class="empty-note">Accept a customer to see relevant published guidance.</div>';
      return;
    }
    if (!results.length) {
      list.innerHTML = '<div class="empty-note">No published article matched this search. Use the scenario guidance and avoid inventing product behaviour.</div>';
      return;
    }
    list.innerHTML = results.map((article) => `
      <article class="article-card"><strong>${escapeHtml(article.title)}</strong><p>${escapeHtml(article.summary)}</p>
      ${article.steps && article.steps.length ? `<details class="article-steps"><summary>View steps</summary><ol>${article.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></details>` : ''}
      <button type="button" data-article-id="${escapeHtml(article.id)}">Use this guidance</button></article>`).join('');
    list.querySelectorAll('[data-article-id]').forEach((button) => button.addEventListener('click', () => {
      try {
        F.markKnowledgeUsed(state, button.dataset.articleId, new Date());
        const active = E.getActiveContact(agentState);
        if (active) {
          active.knowledgeReferences = Array.isArray(active.knowledgeReferences) ? active.knowledgeReferences : [];
          if (!active.knowledgeReferences.includes(button.dataset.articleId)) active.knowledgeReferences.push(button.dataset.articleId);
        }
        persist();
        notify('Published knowledge article attached to this interaction.');
        renderMetrics();
      } catch (error) { notify(error.message, true); }
    }));
  }
  function renderConversation(contact) {
    const conversation = $('#conversation');
    conversation.innerHTML = (contact.messages || []).map((message) => `
      <div class="message ${message.direction === 'Outbound' ? 'outbound' : 'inbound'}">
        <div class="message-head"><span>${escapeHtml(message.author || (message.direction === 'Outbound' ? 'Agent' : 'Customer'))}</span><span>${escapeHtml(message.direction || '')}</span></div>
        ${escapeHtml(message.body)}
      </div>`).join('');
    conversation.scrollTop = conversation.scrollHeight;
  }
  function fillExistingCases(contact) {
    const select = $('#existing-case');
    const cases = openCasesForCustomer(contact.customerId);
    select.innerHTML = cases.length
      ? cases.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference)} · ${escapeHtml(item.subject)}</option>`).join('')
      : '<option value="">No open case found</option>';
    $('#case-action').value = cases.length ? 'existing' : 'create';
    $('#wrap-disposition').value = cases.length ? 'Information provided' : 'Case created';
    $('#existing-case-field').classList.toggle('hidden', !cases.length);
    $('#case-subject-field').classList.toggle('hidden', $('#case-action').value !== 'create');
  }
  function renderWrapUp(contact) {
    const panel = $('#wrapup-panel');
    const wasHidden = panel.classList.contains('hidden');
    const ready = !!(state.active && state.active.readyToWrap);
    panel.classList.toggle('hidden', !ready);
    $('#decision-area').classList.toggle('hidden', ready);
    if (!ready || !wasHidden) return;
    fillExistingCases(contact);
    $('#wrap-summary').value = '';
    $('#case-subject').value = contact.subject;
    $('#case-priority').value = contact.priority;
    $('#wrap-feedback').textContent = '';
  }
  function renderActive() {
    const active = F.getActiveScenario(state, agentState, E);
    if (!active) {
      $('#customer-card').innerHTML = '<div class="empty-note">Customer information appears when a contact is accepted.</div>';
      $('#knowledge-list').innerHTML = '<div class="empty-note">Accept a customer to see relevant guidance.</div>';
      return;
    }
    const { contact, scenario, stage } = active;
    $('#contact-reference').textContent = contact.reference;
    $('#contact-channel').textContent = contact.channel.toUpperCase();
    $('#contact-priority').textContent = contact.priority.toUpperCase();
    $('#contact-priority').className = `priority-chip ${priorityClass(contact.priority)}`;
    $('#contact-subject').textContent = contact.subject;
    $('#contact-focus').textContent = `${scenario.focus} · ${contact.customerTone || 'Customer'} customer`;
    renderConversation(contact);
    renderCustomer(contact);
    renderKnowledge(contact);
    renderWrapUp(contact);
    if (state.active.readyToWrap) return;
    $('#decision-step').textContent = `STEP ${state.active.stageIndex + 1} OF 3`;
    $('#decision-heading').textContent = stage.title;
    $('#decision-prompt').textContent = stage.prompt;
    $('#decision-options').innerHTML = stage.options.map((option, index) => `
      <button type="button" class="decision-option" data-choice-id="${escapeHtml(option.id)}">
        <span class="option-index">${String.fromCharCode(65 + index)}</span><span><strong>${escapeHtml(option.label)}</strong><small>Select the response you would deliver to the customer.</small></span>
      </button>`).join('');
    $('#decision-options').querySelectorAll('[data-choice-id]').forEach((button) => button.addEventListener('click', () => chooseDecision(button.dataset.choiceId)));
  }
  function renderCompleted() {
    const records = state.completedContacts;
    $('#completed-count').textContent = String(records.length);
    const body = $('#completed-table');
    if (!records.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-table">No customer contacts completed yet.</td></tr>';
      return;
    }
    body.innerHTML = records.map((item) => `
      <tr><td><strong>${escapeHtml(item.reference)}</strong></td><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(item.subject)}</td>
      <td class="${item.qa >= 85 ? 'score-good' : item.qa >= 65 ? 'score-mid' : 'score-low'}">${item.qa}%</td><td>${item.csat}/5</td><td>${escapeHtml(item.disposition)}</td></tr>`).join('');
  }
  function renderActivity() {
    const latest = state.activity.slice(0, 3).map((item) => item.message).join(' · ');
    $('#activity-log').textContent = latest || 'No activity recorded.';
  }
  function renderReport() {
    const show = state.shift.status === 'Ended';
    $('#shift-report').classList.toggle('hidden', !show);
    if (!show) return;
    const report = F.getShiftReport(state);
    const items = [
      ['Contacts handled', report.completed], ['Overall shift score', `${report.score}%`], ['Average QA', `${report.averageQa}%`], ['Average CSAT', `${report.averageCsat}/5`],
      ['First contact resolution', `${report.fcrRate}%`], ['Compliance breaches', report.complianceBreaches], ['Knowledge references', report.knowledgeUses], ['Average handle time', `${report.averageHandleMinutes} min`]
    ];
    $('#report-grid').innerHTML = items.map(([label, value]) => `<div class="report-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    $('#report-note').textContent = `Briefings: morning ${report.attendedMorningBriefing ? 'attended' : 'missed'}, afternoon ${report.attendedAfternoonBriefing ? 'attended' : 'not due'}. Scheduled breaks ${report.attendedBreaks ? 'completed' : 'not both completed'}. This is a simulated performance record, not an employment decision.`;
  }
  function renderAll() {
    renderClockAndStatus(); renderMetrics(); renderEvent(); renderRoutine(); renderQueue();
    if (state.active) renderActive();
    else {
      $('#customer-card').innerHTML = '<div class="empty-note">Customer information appears when a contact is accepted.</div>';
      $('#knowledge-list').innerHTML = '<div class="empty-note">Accept a customer to see relevant guidance.</div>';
    }
    renderCompleted(); renderActivity(); renderReport();
  }
  function acceptContact(contactId) {
    try {
      $('#decision-feedback').classList.add('hidden');
      F.beginContact(state, agentState, E, contactId, new Date());
      persist(); renderAll(); notify('Customer contact accepted. Begin with the first service decision.');
    } catch (error) { notify(error.message, true); }
  }
  function chooseDecision(choiceId) {
    try {
      const result = F.chooseResponse(state, agentState, E, choiceId, new Date());
      const feedback = $('#decision-feedback');
      feedback.classList.remove('hidden', 'bad');
      const severe = result.result.complianceBreach;
      feedback.classList.toggle('bad', severe || result.result.score < 50);
      feedback.textContent = `${result.result.note}${severe ? ' This is a critical failure and will affect the shift record.' : ''}`;
      persist(); renderAll();
      if (result.complete) notify('All three service decisions completed. Record the wrap-up.');
      else if (result.dueEvent) notify(`${result.dueEvent.title} will be due after this interaction is wrapped up.`);
    } catch (error) { notify(error.message, true); }
  }
  function updateCaseActionFields() {
    const action = $('#case-action').value;
    $('#existing-case-field').classList.toggle('hidden', action !== 'existing');
    $('#case-subject-field').classList.toggle('hidden', action !== 'create');
    if (action === 'create' && $('#wrap-disposition').value !== 'Case created') $('#wrap-disposition').value = 'Case created';
    if (action === 'skip' && $('#wrap-disposition').value === 'Case created') $('#wrap-disposition').value = 'Guidance provided';
    if (action === 'existing' && $('#wrap-disposition').value === 'Case created') $('#wrap-disposition').value = 'Information provided';
    if (action === 'existing' && !$('#existing-case').value) $('#wrap-feedback').textContent = 'Select an open case for this customer, or choose create a new case.';
    else $('#wrap-feedback').textContent = '';
  }
  function submitWrapUp(event) {
    event.preventDefault();
    const contact = E.getActiveContact(agentState);
    if (!contact) return;
    const caseAction = $('#case-action').value;
    if (caseAction === 'existing' && !$('#existing-case').value) {
      $('#wrap-feedback').textContent = 'No open case is available. Select create a new case or customer note only.';
      return;
    }
    const disposition = $('#wrap-disposition').value;
    if (disposition === 'Case created' && !['create', 'existing'].includes(caseAction)) {
      $('#wrap-feedback').textContent = 'A case-created disposition requires a linked case.';
      return;
    }
    const input = {
      disposition,
      summary: $('#wrap-summary').value,
      caseAction,
      existingCaseId: $('#existing-case').value,
      category: $('#case-category').value,
      priority: $('#case-priority').value,
      caseSubject: $('#case-subject').value
    };
    try {
      const result = F.finishContact(state, agentState, E, C, realStorage, input, new Date());
      persist(); articleQuery = ''; $('#knowledge-query').value = '';
      renderAll();
      notify(`${result.completed.reference} saved. QA ${result.record.qa}% · CSAT ${result.record.csat}/5.`);
    } catch (error) { $('#wrap-feedback').textContent = error.message; }
  }
  function doShiftEvent() {
    const due = F.dueEvent(state);
    if (!due) return;
    try {
      F.attendEvent(state, due.id, new Date());
      persist(); renderAll();
      notify(`${due.title} completed.`);
    } catch (error) { notify(error.message, true); }
  }
  function finishShift() {
    try {
      F.endShift(state, agentState, E, new Date());
      persist(); renderAll();
      notify('Shift ended. Performance report is ready.');
    } catch (error) { notify(error.message, true); }
  }

  $('#start-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      F.startShift(state, agentState, E, { name: $('#agent-name').value, team: $('#agent-team').value }, new Date());
      persist(); renderAll(); notify('Shift started. Attend the 07:30 briefing before accepting contacts.');
    } catch (error) { notify(error.message, true); }
  });
  $('#complete-event').addEventListener('click', doShiftEvent);
  $('#end-shift').addEventListener('click', finishShift);
  $('#queue-channel').addEventListener('change', (event) => { selectedChannel = event.target.value; renderQueue(); });
  $('#knowledge-query').addEventListener('input', (event) => { articleQuery = event.target.value; const contact = state.active && E.getActiveContact(agentState); if (contact) renderKnowledge(contact); });
  $('#knowledge-search-button').addEventListener('click', () => { articleQuery = $('#knowledge-query').value; const contact = state.active && E.getActiveContact(agentState); if (contact) renderKnowledge(contact); });
  $('#case-action').addEventListener('change', updateCaseActionFields);
  $('#wrapup-form').addEventListener('submit', submitWrapUp);
  renderAll();
  window.CalloriaLiveFloor = { getState: () => state, getAgentState: () => agentState, refresh: renderAll, engine: F };
})();
