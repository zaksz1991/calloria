(function () {
  'use strict';
  const E = window.CalloriaVoiceOfCustomerEngine;
  if (!E) return;
  const $ = (selector) => document.querySelector(selector);
  const now = () => new Date();
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmtDate = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  };
  const fmtDateShort = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  };
  const productName = (id) => (E.PRODUCTS.find((item) => item.id === id) || E.PRODUCTS[0]).name;
  const hasExisting = !!localStorage.getItem(E.STORAGE_KEY);
  let state = E.load(localStorage, now());
  let selectedFeedbackId = state.feedback[0] && state.feedback[0].id;
  let toastTimer = null;
  if (!hasExisting) E.save(state, localStorage);

  function notify(message, error) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', !!error);
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }
  function populateSelect(selector, rows, labelFn) {
    const select = $(selector);
    select.innerHTML = rows.map((row) => { const value = row.value !== undefined ? row.value : row.id; return `<option value="${escapeHtml(value)}">${escapeHtml(labelFn(row))}</option>`; }).join('');
  }
  function initialiseForms() {
    populateSelect('#input-channel', E.CHANNELS.map((value) => ({ value })), (row) => row.value);
    populateSelect('#input-product', E.PRODUCTS, (row) => row.name);
    populateSelect('#input-theme', E.THEMES.map((value) => ({ value })), (row) => row.value);
    populateSelect('#input-nps', Array.from({ length: 11 }, (_, value) => ({ value: String(value) })), (row) => `${row.value} — ${Number(row.value) >= 9 ? 'Promoter' : Number(row.value) >= 7 ? 'Passive' : 'Detractor'}`);
    populateSelect('#recovery-status', E.RECOVERY_STATUSES.map((value) => ({ value })), (row) => row.value);
  }
  function metricsRender() {
    const dashboard = E.getDashboard(state, now());
    $('#metric-responses').textContent = dashboard.responses;
    $('#metric-csat').textContent = dashboard.csatAverage == null ? '—' : dashboard.csatAverage.toFixed(1) + '/5';
    $('#metric-satisfied').textContent = dashboard.csatSatisfiedPct == null ? '—' : dashboard.csatSatisfiedPct + '%';
    $('#metric-nps').textContent = dashboard.nps == null ? '—' : (dashboard.nps > 0 ? '+' : '') + dashboard.nps;
    $('#metric-ces').textContent = dashboard.cesAverage == null ? '—' : dashboard.cesAverage.toFixed(1) + '/5';
    $('#metric-recovery').textContent = dashboard.openRecovery;
    $('#metric-overdue').textContent = `${dashboard.overdueRecovery} overdue`;
    $('#feedback-count').textContent = state.feedback.length;
    $('#invitation-count').textContent = state.invitations.filter((item) => item.status === 'Ready to record').length;
    $('#recovery-count').textContent = state.recoveryTasks.filter((item) => !['Resolved', 'Closed'].includes(item.status)).length;
    renderNps(dashboard);
    renderThemes(dashboard.themes);
    renderChannels(dashboard.channels);
  }
  function renderNps(dashboard) {
    const rows = [
      { label: 'Promoters', count: dashboard.promoters, tone: 'green' },
      { label: 'Passives', count: dashboard.passives, tone: 'amber' },
      { label: 'Detractors', count: dashboard.detractors, tone: 'red' }
    ];
    const max = Math.max(1, dashboard.responses);
    $('#nps-bars').innerHTML = rows.map((row) => `<div class="bar-row"><label>${row.label}</label><div class="bar-track"><div class="bar-fill ${row.tone}" style="width:${Math.max(0, row.count / max * 100)}%"></div></div><strong>${row.count}</strong></div>`).join('');
  }
  function renderThemes(themes) {
    const rows = Object.entries(themes).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = Math.max(1, ...rows.map((row) => row[1]));
    $('#theme-bars').innerHTML = rows.length ? rows.map(([label, count]) => `<div class="bar-row"><label title="${escapeHtml(label)}">${escapeHtml(label)}</label><div class="bar-track"><div class="bar-fill" style="width:${count / max * 100}%"></div></div><strong>${count}</strong></div>`).join('') : '<div class="empty-cell">No theme data.</div>';
  }
  function renderChannels(channels) {
    $('#channel-rows').innerHTML = channels.length ? channels.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.count}</td><td>${row.csatAverage.toFixed(1)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-cell">No channel data.</td></tr>';
  }
  function filteredFeedback() {
    const query = $('#feedback-search').value.trim().toLowerCase();
    const filter = $('#feedback-filter').value;
    return state.feedback.filter((item) => {
      if (query && ![item.reference, item.customerId, item.contactRef, item.caseId, item.comment, item.theme, item.channel, productName(item.productId)].join(' ').toLowerCase().includes(query)) return false;
      if (filter === 'recovery' && !E.isRecoveryRequired(item)) return false;
      if (['Promoter', 'Passive', 'Detractor'].includes(filter) && (item.promoterGroup || E.npsGroup(item.nps)) !== filter) return false;
      return true;
    }).sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
  }
  function renderFeedbackList() {
    const rows = filteredFeedback();
    if (!rows.some((item) => item.id === selectedFeedbackId)) selectedFeedbackId = rows[0] && rows[0].id;
    $('#feedback-list').innerHTML = rows.length ? rows.map((item) => {
      const scoreClass = item.csat <= 2 ? 'low' : item.csat >= 4 ? 'high' : '';
      return `<article class="feedback-item ${item.id === selectedFeedbackId ? 'selected' : ''}" data-feedback-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Open feedback ${escapeHtml(item.reference || item.id)}">
        <div class="feedback-item-top"><strong>${escapeHtml(item.reference || item.id)}</strong><span class="rating-pill ${scoreClass}">CSAT ${item.csat}/5</span></div>
        <p>${escapeHtml(item.comment)}</p>
        <div class="feedback-item-bottom"><span>${escapeHtml(item.customerId || 'Unlinked')} · ${escapeHtml(item.channel)}</span><span>${escapeHtml(item.promoterGroup || E.npsGroup(item.nps))}</span></div>
        <div class="feedback-item-bottom"><span>${escapeHtml(item.theme)}</span>${item.demo ? '<span class="flag demo">SAMPLE</span>' : E.isRecoveryRequired(item) ? '<span class="flag">RECOVERY</span>' : ''}</div>
      </article>`;
    }).join('') : '<div class="empty-state"><strong>No matching feedback</strong><p>Clear the search or record a new response.</p></div>';
    document.querySelectorAll('[data-feedback-id]').forEach((node) => {
      const select = () => { selectedFeedbackId = node.dataset.feedbackId; renderFeedbackList(); renderDetail(); };
      node.addEventListener('click', select);
      node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
    });
    renderDetail();
  }
  function renderDetail() {
    const item = E.getFeedback(state, selectedFeedbackId);
    const target = $('#feedback-detail');
    if (!item) {
      $('#detail-state').textContent = 'SELECT A RESPONSE';
      target.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div><strong>No response selected</strong><p>Select a feedback record to inspect its scores, customer comment and case link.</p></div>';
      return;
    }
    $('#detail-state').textContent = item.demo ? 'SAMPLE RECORD' : 'RECORDED';
    const task = item.recoveryTaskId ? E.getRecoveryTask(state, item.recoveryTaskId) : state.recoveryTasks.find((row) => row.feedbackId === item.id);
    const risk = E.isRecoveryRequired(item) ? `<div class="risk-banner"><strong>Recovery required.</strong> ${escapeHtml(E.recoveryReason(item))}. ${task ? `Task ${escapeHtml(task.id)} is ${escapeHtml(task.status.toLowerCase())}.` : 'Create a recovery task to track the response.'}</div>` : '<div class="risk-banner" style="background:#edf9f2;border-color:#d2efdf;color:#216c4d">No automatic recovery threshold was triggered by these ratings.</div>';
    target.innerHTML = `
      <div class="detail-top"><div><h3>${escapeHtml(item.reference || item.id)}</h3><small>${escapeHtml(fmtDate(item.capturedAt))} · ${escapeHtml(item.source || 'Recorded response')}</small></div><span class="rating-pill ${E.isRecoveryRequired(item) ? 'low' : 'high'}">${escapeHtml(item.promoterGroup || E.npsGroup(item.nps))}</span></div>
      <div class="score-grid">
        <div class="score-box"><span>CSAT · satisfaction</span><strong>${item.csat}/5</strong><small>${item.csat >= 4 ? 'Satisfied' : item.csat === 3 ? 'Neutral' : 'Dissatisfied'}</small></div>
        <div class="score-box"><span>NPS · recommend</span><strong>${item.nps}/10</strong><small>${escapeHtml(item.promoterGroup || E.npsGroup(item.nps))}</small></div>
        <div class="score-box"><span>CES · ease</span><strong>${item.ces}/5</strong><small>${item.ces >= 4 ? 'Easy' : item.ces === 3 ? 'Neutral' : 'Difficult'}</small></div>
      </div>
      ${risk}
      <div class="detail-comment">“${escapeHtml(item.comment)}”</div>
      <div class="detail-meta">
        <div><span>CUSTOMER</span><strong>${escapeHtml(item.customerId || 'Not linked')}</strong></div>
        <div><span>CONTACT</span><strong>${escapeHtml(item.contactRef || 'Not linked')}</strong></div>
        <div><span>CASE</span><strong>${escapeHtml(item.caseId || 'Not linked')}</strong></div>
        <div><span>CHANNEL / PRODUCT</span><strong>${escapeHtml(item.channel)} · ${escapeHtml(productName(item.productId))}</strong></div>
        <div><span>PRIMARY THEME</span><strong>${escapeHtml(item.theme)}</strong></div>
        <div><span>DATA TYPE</span><strong>${item.demo ? 'Demonstration sample' : 'Recorded response'}</strong></div>
      </div>
      <div class="detail-actions">
        ${item.caseId ? `<button id="attach-case" class="button button-secondary">Attach scores to Customer 360 case</button>` : ''}
        ${task ? `<button id="open-recovery-task" class="button button-ghost">Open recovery task</button>` : E.isRecoveryRequired(item) ? '<button id="create-recovery-task" class="button button-secondary">Create recovery task</button>' : ''}
      </div>`;
    if ($('#attach-case')) $('#attach-case').addEventListener('click', () => {
      try { E.syncCaseSatisfaction(state, item.id, localStorage, now()); persist(); notify(`Feedback attached to Customer 360 case ${item.caseId}.`); renderAll(); }
      catch (error) { notify(error.message, true); }
    });
    if ($('#open-recovery-task')) $('#open-recovery-task').addEventListener('click', () => openRecovery(task.id));
    if ($('#create-recovery-task')) $('#create-recovery-task').addEventListener('click', () => {
      try { const created = E.createRecoveryTask(state, item, now()); item.recoveryTaskId = created.id; persist(); renderAll(); notify('Recovery task created.'); }
      catch (error) { notify(error.message, true); }
    });
  }
  function renderInvitations() {
    const rows = state.invitations.slice().sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    $('#invitation-rows').innerHTML = rows.length ? rows.map((item) => `<tr>
      <td><strong>${escapeHtml(item.contactRef)}</strong></td><td>${escapeHtml(item.customerId || 'Unlinked')}</td><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(productName(item.productId))}</td><td>${escapeHtml(fmtDateShort(item.completedAt))}</td><td><span class="status-label ${item.status === 'Feedback recorded' ? 'closed' : 'open'}">${escapeHtml(item.status)}</span></td>
      <td>${item.status === 'Ready to record' ? `<button class="table-action" data-invitation-id="${escapeHtml(item.id)}">Record response</button>` : '—'}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-cell">No imported completed contacts yet.</td></tr>';
    document.querySelectorAll('[data-invitation-id]').forEach((button) => button.addEventListener('click', () => openFeedback(E.getInvitation(state, button.dataset.invitationId))));
  }
  function renderRecovery() {
    const rows = state.recoveryTasks.slice().sort((a, b) => {
      const aOpen = ['Resolved', 'Closed'].includes(a.status) ? 1 : 0;
      const bOpen = ['Resolved', 'Closed'].includes(b.status) ? 1 : 0;
      return aOpen - bOpen || String(a.dueAt).localeCompare(String(b.dueAt));
    });
    $('#recovery-rows').innerHTML = rows.length ? rows.map((task) => {
      const overdue = !['Resolved', 'Closed'].includes(task.status) && new Date(task.dueAt).getTime() < Date.now();
      return `<tr><td><strong>${escapeHtml(task.id)}</strong></td><td>${escapeHtml(task.customerId || 'Unlinked')}<br><small>${escapeHtml(task.contactRef || 'No contact ref')}</small></td><td>${escapeHtml(task.reason)}</td><td><span class="priority-label ${task.priority === 'Urgent' ? 'urgent' : ''}">${escapeHtml(task.priority)}</span></td><td>${escapeHtml(task.owner)}</td><td><span class="status-label ${['Resolved', 'Closed'].includes(task.status) ? 'closed' : 'open'}">${escapeHtml(task.status)}</span></td><td>${overdue ? '<span class="priority-label urgent">OVERDUE · </span>' : ''}${escapeHtml(fmtDateShort(task.dueAt))}</td><td><button class="table-action" data-recovery-id="${escapeHtml(task.id)}">Update</button></td></tr>`;
    }).join('') : '<tr><td colspan="8" class="empty-cell">No recovery tasks.</td></tr>';
    document.querySelectorAll('[data-recovery-id]').forEach((button) => button.addEventListener('click', () => openRecovery(button.dataset.recoveryId)));
  }
  function renderAll() { metricsRender(); renderFeedbackList(); renderInvitations(); renderRecovery(); }
  function persist() {
    if (!E.save(state, localStorage)) throw new Error('Browser storage is full or unavailable. The change was not saved.');
  }
  function openFeedback(invitation) {
    $('#feedback-form').reset();
    $('#feedback-error').textContent = '';
    $('#invitation-id').value = invitation ? invitation.id : '';
    $('#feedback-form-context').textContent = invitation ? `Recording a response for ${invitation.contactRef}. This action does not send a survey.` : 'Record a response provided by the customer. No outbound survey is sent.';
    $('#input-customer').value = invitation ? invitation.customerId : '';
    $('#input-contact').value = invitation ? invitation.contactRef : '';
    $('#input-case').value = invitation ? invitation.caseId || '' : '';
    $('#input-channel').value = invitation ? invitation.channel : 'Email';
    $('#input-product').value = invitation ? invitation.productId : 'general';
    ['#input-channel', '#input-product'].forEach((selector) => { $(selector).disabled = !!invitation; });
    $('#input-csat').value = '3'; $('#input-nps').value = '7'; $('#input-ces').value = '3';
    $('#feedback-dialog').showModal();
  }
  function closeFeedback() { $('#feedback-dialog').close(); }
  function openRecovery(taskId) {
    const task = E.getRecoveryTask(state, taskId);
    if (!task) return notify('Recovery task was not found.', true);
    $('#recovery-form').reset(); $('#recovery-error').textContent = '';
    $('#recovery-task-id').value = task.id;
    $('#recovery-context').textContent = `${task.id} · ${task.customerId || 'Unlinked customer'} · ${task.reason}`;
    $('#recovery-owner').value = task.owner;
    $('#recovery-status').value = task.status;
    $('#recovery-resolution').value = task.resolution || '';
    $('#recovery-dialog').showModal();
  }
  function exportFile(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  $('#import-contacts').addEventListener('click', () => {
    try {
      const imported = E.importFromStorage(state, localStorage, now());
      persist(); renderAll();
      notify(imported.length ? `${imported.length} completed contact(s) added to the feedback-entry queue.` : 'No new completed contacts found in the v5.5 workbench.');
    } catch (error) { notify(error.message, true); }
  });
  $('#new-feedback').addEventListener('click', () => openFeedback(null));
  $('#feedback-search').addEventListener('input', renderFeedbackList);
  $('#feedback-filter').addEventListener('change', renderFeedbackList);
  $('#feedback-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const invitationId = $('#invitation-id').value || null;
      const item = E.createFeedback(state, {
        invitationId, customerId: $('#input-customer').value, contactRef: $('#input-contact').value,
        caseId: $('#input-case').value, channel: $('#input-channel').value, productId: $('#input-product').value,
        theme: $('#input-theme').value, csat: $('#input-csat').value, nps: $('#input-nps').value,
        ces: $('#input-ces').value, comment: $('#input-comment').value,
        source: invitationId ? 'v5.5 completed-contact survey entry' : 'Manually recorded'
      }, now());
      persist(); selectedFeedbackId = item.id; closeFeedback();
      $('#input-channel').disabled = false; $('#input-product').disabled = false;
      renderAll(); notify(`Feedback ${item.reference} saved${item.recoveryTaskId ? ' and recovery task created' : ''}.`);
    } catch (error) { $('#feedback-error').textContent = error.message; }
  });
  ['#close-feedback', '#cancel-feedback'].forEach((selector) => $(selector).addEventListener('click', closeFeedback));
  $('#feedback-dialog').addEventListener('close', () => { $('#input-channel').disabled = false; $('#input-product').disabled = false; });
  $('#recovery-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      E.updateRecoveryTask(state, $('#recovery-task-id').value, {
        owner: $('#recovery-owner').value, status: $('#recovery-status').value,
        note: $('#recovery-note').value, resolution: $('#recovery-resolution').value
      }, now());
      persist(); $('#recovery-dialog').close(); renderAll(); notify('Recovery task updated.');
    } catch (error) { $('#recovery-error').textContent = error.message; }
  });
  ['#close-recovery', '#cancel-recovery'].forEach((selector) => $(selector).addEventListener('click', () => $('#recovery-dialog').close()));
  $('#export-menu-button').addEventListener('click', () => {
    const menu = $('#export-menu'); const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen); $('#export-menu-button').setAttribute('aria-expanded', String(!isOpen));
  });
  $('#export-feedback').addEventListener('click', () => { exportFile('calloria-feedback-register.csv', E.exportFeedbackCsv(state)); $('#export-menu').classList.add('hidden'); });
  $('#export-recovery').addEventListener('click', () => { exportFile('calloria-service-recovery-register.csv', E.exportRecoveryCsv(state)); $('#export-menu').classList.add('hidden'); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.export-menu')) { $('#export-menu').classList.add('hidden'); $('#export-menu-button').setAttribute('aria-expanded', 'false'); }
  });

  initialiseForms();
  renderAll();
})();
