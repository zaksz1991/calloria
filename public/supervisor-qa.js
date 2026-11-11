(function () {
  'use strict';
  const Engine = window.CalloriaSupervisorQAEngine;
  if (!Engine) {
    document.body.innerHTML = '<main style="padding:32px;color:#fff;font-family:Arial">CALLORIA Supervisor & QA could not start: its engine file is missing.</main>';
    return;
  }

  let state = Engine.loadState();
  let currentView = 'overview';
  let selectedInteractionId = state.interactions[0] ? state.interactions[0].id : null;
  let selectedEscalationId = null;
  let qaRatings = Object.fromEntries(Engine.QA_CRITERIA.map((item) => [item.id, 3]));
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AG';
  const priorityClass = (priority) => String(priority || 'normal').toLowerCase();
  const agentById = (id) => state.agents.find((agent) => agent.id === id);
  const interactionById = (id) => state.interactions.find((item) => item.id === id);

  function persist() { Engine.saveState(state); }
  function toast(message, type) {
    const region = $('#toast-region');
    const item = document.createElement('div');
    item.className = `toast${type === 'error' ? ' error' : ''}`;
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(() => item.remove(), 3300);
  }
  function setView(view) {
    if (!$('#view-' + view)) return;
    currentView = view;
    $$('.view').forEach((section) => section.classList.toggle('active', section.id === 'view-' + view));
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    const labels = { overview: 'Overview', monitoring: 'Live monitoring', quality: 'Quality assurance', coaching: 'Agent coaching', escalations: 'Escalations', team: 'Team performance' };
    $('#page-crumb').textContent = labels[view] || 'Operations';
    $('#sidebar').classList.remove('open');
    renderCurrentView();
  }
  function updateGlobalCounts() {
    const metrics = Engine.deriveMetrics(state);
    $('#nav-open-count').textContent = String(metrics.active);
    $('#nav-escalation-count').textContent = String(metrics.openEscalations);
    $('#escalation-open-chip').textContent = `${metrics.openEscalations} OPEN CASE${metrics.openEscalations === 1 ? '' : 'S'}`;
  }
  function metricCard(label, value, foot, icon) {
    return `<article class="metric-card"><div class="metric-top"><span>${escapeHtml(label)}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-foot">${foot}</div></article>`;
  }
  function renderMetrics() {
    const metrics = Engine.deriveMetrics(state);
    $('#overview-metrics').innerHTML = [
      metricCard('Active contacts', metrics.active, '<strong>Current queue</strong> · all channels', '◉'),
      metricCard('Average QA score', `${metrics.qa}%`, '<strong>Team quality</strong> · latest snapshot', '✓'),
      metricCard('Open escalations', metrics.openEscalations, '<strong>Require ownership</strong> · not resolved', '⚑'),
      metricCard('Contacts handled', metrics.handled, '<strong>Shift activity</strong> · demo roster', '↗')
    ].join('');
  }
  function renderOverview() {
    renderMetrics();
    const attention = state.interactions.filter((item) => item.status === 'Active' || item.status === 'Wrap-up').sort((a, b) => ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[a.priority] ?? 4) - ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[b.priority] ?? 4)).slice(0, 5);
    $('#attention-list').innerHTML = attention.length ? attention.map((item) => `<div class="attention-row"><span class="priority-dot ${priorityClass(item.priority)}"></span><div class="attention-main"><strong>${escapeHtml(item.agent)} · ${escapeHtml(item.channel)}</strong><span>${escapeHtml(item.subject)} · ${escapeHtml(item.id)}</span></div><div class="attention-meta"><b>${escapeHtml(item.priority)}</b><small>${escapeHtml(item.elapsed)}</small></div></div>`).join('') : '<div class="empty-list">No contacts currently require attention.</div>';
    $('#activity-list').innerHTML = state.activity.slice(0, 5).map((item) => `<div class="activity-item"><span class="activity-line"></span><div class="activity-copy"><p>${escapeHtml(item.text)}</p><time>${escapeHtml(item.time)}</time></div></div>`).join('') || '<div class="empty-list">No recent activity.</div>';
    $('#team-snapshot-list').innerHTML = state.agents.slice(0, 4).map((agent) => `<div class="mini-agent"><div class="avatar">${escapeHtml(initials(agent.name))}</div><div class="mini-agent-copy"><strong>${escapeHtml(agent.name)}</strong><span>${escapeHtml(agent.status)} · ${escapeHtml(agent.team)}</span></div><span class="mini-score">${escapeHtml(agent.qa)}% QA</span></div>`).join('');
    const open = state.escalations.filter((item) => item.status !== 'Resolved').slice(0, 3);
    $('#escalation-snapshot-list').innerHTML = open.length ? open.map((item) => `<div class="mini-escalation"><span class="escalation-symbol">⚑</span><div class="mini-escalation-main"><strong>${escapeHtml(item.id)} · ${escapeHtml(item.customer)}</strong><span>${escapeHtml(item.reason)}</span></div><span class="priority-label ${priorityClass(item.priority)}">${escapeHtml(item.priority)}</span></div>`).join('') : '<div class="empty-list">No outstanding escalations.</div>';
  }
  function renderInteractionList() {
    const filters = { query: $('#interaction-search').value, channel: $('#channel-filter').value, status: $('#status-filter').value, priority: $('#priority-filter').value };
    const list = Engine.filterInteractions(state.interactions, filters);
    $('#queue-summary').textContent = `${list.length} matching contact${list.length === 1 ? '' : 's'} · ${state.interactions.filter((item) => item.status === 'Active').length} active`;
    $('#interaction-list').innerHTML = list.length ? list.map((item) => `<button type="button" class="interaction-row ${selectedInteractionId === item.id ? 'selected' : ''}" data-interaction-id="${escapeHtml(item.id)}"><div><div class="interaction-head"><strong>${escapeHtml(item.agent)}</strong><span class="channel-tag">${escapeHtml(item.channel)}</span></div><div class="interaction-subject">${escapeHtml(item.subject)}</div><div class="interaction-meta"><span>${escapeHtml(item.id)}</span><span>Customer: ${escapeHtml(item.customer)}</span><span>${escapeHtml(item.status)}</span></div></div><div class="interaction-side"><span class="priority-label ${priorityClass(item.priority)}">${escapeHtml(item.priority)}</span><span class="elapsed">${escapeHtml(item.elapsed)}</span></div></button>`).join('') : '<div class="empty-list">No interaction matches the selected filters.</div>';
    if (selectedInteractionId && !list.some((item) => item.id === selectedInteractionId)) selectedInteractionId = list[0] ? list[0].id : null;
    renderInteractionDetail();
  }
  function renderInteractionDetail() {
    const item = interactionById(selectedInteractionId);
    const root = $('#interaction-detail');
    if (!item) {
      root.innerHTML = '<div class="empty-state"><div class="empty-icon">◉</div><h3>No interaction selected</h3><p>Adjust the queue filters or select an item to inspect the contact.</p></div>';
      return;
    }
    const transcript = item.transcript || [];
    const escalation = state.escalations.find((entry) => entry.interactionId === item.id && entry.status !== 'Resolved');
    root.innerHTML = `<div class="detail-header"><div class="detail-title-row"><div><h2>${escapeHtml(item.subject)}</h2><p>${escapeHtml(item.id)} · Customer ${escapeHtml(item.customer)}</p></div><span class="priority-label ${priorityClass(item.priority)}">${escapeHtml(item.priority)} PRIORITY</span></div><div class="detail-tags"><span class="channel-tag">${escapeHtml(item.channel)}</span><span class="channel-tag">${escapeHtml(item.status)}</span><span class="channel-tag">Sentiment: ${escapeHtml(item.sentiment)}</span>${item.monitored ? '<span class="channel-tag">Monitored</span>' : ''}${item.assistance ? '<span class="channel-tag">Supervisor support requested</span>' : ''}</div><div class="detail-facts"><div class="fact-box"><span>Assigned agent</span><strong>${escapeHtml(item.agent)}</strong></div><div class="fact-box"><span>Started</span><strong>${escapeHtml(item.started)}</strong></div><div class="fact-box"><span>Elapsed</span><strong>${escapeHtml(item.elapsed)}</strong></div></div></div><div class="transcript-wrap"><div class="transcript-heading">INTERACTION TRANSCRIPT · ${transcript.length} ENTRIES</div><div class="transcript">${transcript.map((line) => `<div class="message ${line[1] === 'Agent' ? 'agent' : ''}"><time>${escapeHtml(line[0])}</time><div class="message-content"><div class="message-name">${escapeHtml(line[1])}</div>${escapeHtml(line[2])}</div></div>`).join('')}</div></div><div class="detail-actions"><button class="button small support" data-action="monitor-contact">${item.monitored ? 'Monitoring active' : 'Start monitoring'}</button><button class="button small secondary" data-action="request-support">${item.assistance ? 'Support requested' : 'Request supervisor support'}</button><button class="button small danger-outline" data-action="raise-escalation">${escalation ? 'View escalation' : 'Raise escalation'}</button><button class="button small success-outline" data-action="complete-contact" ${item.status === 'Completed' ? 'disabled' : ''}>Mark completed</button></div>`;
  }
  function renderQaForm() {
    const eligible = state.interactions.filter((item) => item.status === 'Completed' || item.status === 'Wrap-up');
    const current = $('#qa-interaction').value;
    $('#qa-interaction').innerHTML = eligible.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.agent)} · ${escapeHtml(item.channel)}</option>`).join('');
    if (eligible.some((item) => item.id === current)) $('#qa-interaction').value = current;
    else if (eligible.length) $('#qa-interaction').value = eligible[0].id;
    else $('#qa-interaction').innerHTML = '<option value="">No wrap-up or completed contacts available</option>';
    $('#qa-criteria').innerHTML = Engine.QA_CRITERIA.map((criterion) => `<div class="criterion-row"><div><div class="criterion-title">${escapeHtml(criterion.label)} <span class="criterion-weight">${criterion.weight}%${criterion.critical ? ' · CRITICAL' : ''}</span></div><div class="criterion-help">${criterion.critical ? 'A rating below 3 triggers a critical fail.' : 'Rate the evidence demonstrated in this interaction.'}</div></div><div class="rating-group" role="group" aria-label="Rate ${escapeHtml(criterion.label)}">${[1,2,3,4,5].map((value) => `<button type="button" class="rating-button ${qaRatings[criterion.id] === value ? 'selected' : ''}" data-criterion="${criterion.id}" data-rating="${value}" aria-pressed="${qaRatings[criterion.id] === value}">${value}</button>`).join('')}</div></div>`).join('');
    updateQaPreview();
  }
  function updateQaPreview() {
    const result = Engine.calculateQaScore(qaRatings);
    $('#qa-preview-score').textContent = `${result.score}%`;
    $('#qa-preview-outcome').textContent = result.outcome === 'Fail' ? 'Critical fail / below standard' : result.outcome === 'Pass' ? 'Meets quality standard' : 'Coaching required';
  }
  function renderQaHistory() {
    const list = state.evaluations.slice().reverse();
    $('#qa-history-count').textContent = `${list.length} RECORD${list.length === 1 ? '' : 'S'}`;
    $('#qa-history-list').innerHTML = list.length ? list.map((entry) => `<div class="history-item"><div class="history-top"><strong>${escapeHtml(entry.agent)} · ${escapeHtml(entry.interactionId)}</strong><span class="score-pill">${escapeHtml(entry.score)}%</span></div><div class="history-meta">${escapeHtml(entry.channel)} · ${escapeHtml(entry.evaluator)} · ${escapeHtml(new Date(entry.date).toLocaleDateString())}</div><div class="history-meta"><span class="outcome-pill ${entry.outcome === 'Fail' ? 'fail' : entry.outcome === 'Pass' ? 'pass' : 'coaching'}">${escapeHtml(entry.outcome)}</span>${entry.notes ? ' · ' + escapeHtml(entry.notes) : ''}</div></div>`).join('') : '<div class="empty-list">No evaluations saved yet. Complete a wrap-up or completed contact to begin.</div>';
  }
  function renderCoaching() {
    $('#coaching-agent').innerHTML = state.agents.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)} · ${escapeHtml(agent.team)}</option>`).join('');
    const list = state.coaching.slice().reverse();
    $('#coaching-count').textContent = `${list.length} RECORD${list.length === 1 ? '' : 'S'}`;
    $('#coaching-list').innerHTML = list.length ? list.map((item) => `<div class="coaching-card" data-coaching-id="${escapeHtml(item.id)}"><div class="coaching-top"><strong>${escapeHtml(item.agent)}</strong><span class="status-pill ${priorityClass(item.status)}">${escapeHtml(item.status)}</span></div><div class="coaching-meta">${escapeHtml(item.focus)} · Review ${escapeHtml(item.reviewDate)}</div><p><strong>Observed:</strong> ${escapeHtml(item.observed)}</p><p><strong>Agreed action:</strong> ${escapeHtml(item.action)}</p><div class="coaching-card-actions">${item.status !== 'Delivered' ? `<button class="button secondary" data-coaching-action="Delivered" data-id="${escapeHtml(item.id)}">Mark delivered</button>` : ''}${item.status !== 'Completed' ? `<button class="button success-outline" data-coaching-action="Completed" data-id="${escapeHtml(item.id)}">Complete review</button>` : ''}</div></div>`).join('') : '<div class="empty-list">No coaching records yet. Save a plan to track an agent development action.</div>';
  }
  function renderEscalations() {
    const filter = $('#escalation-filter').value;
    const list = state.escalations.filter((item) => filter === 'All cases' || item.status === filter);
    $('#escalation-list').innerHTML = list.length ? list.map((item) => `<button type="button" class="escalation-card ${selectedEscalationId === item.id ? 'selected' : ''}" data-escalation-id="${escapeHtml(item.id)}"><div class="escalation-card-top"><strong>${escapeHtml(item.id)} · ${escapeHtml(item.customer)}</strong><span class="status-pill ${item.status === 'Resolved' ? 'resolved' : item.status === 'In review' ? 'review' : 'open'}">${escapeHtml(item.status)}</span></div><p>${escapeHtml(item.reason)}</p><div class="escalation-meta">${escapeHtml(item.agent)} · ${escapeHtml(item.priority)} priority · Owner: ${escapeHtml(item.owner)}</div></button>`).join('') : '<div class="empty-list">No cases match this filter.</div>';
    if (selectedEscalationId && !list.some((item) => item.id === selectedEscalationId)) selectedEscalationId = list[0] ? list[0].id : null;
    renderEscalationDetail();
    updateGlobalCounts();
  }
  function renderEscalationDetail() {
    const item = state.escalations.find((entry) => entry.id === selectedEscalationId);
    const root = $('#escalation-detail');
    if (!item) {
      root.innerHTML = '<div class="empty-state"><div class="empty-icon">⚑</div><h3>Select an escalation</h3><p>Choose a case to assign an owner, update status and record the resolution.</p></div>';
      return;
    }
    root.innerHTML = `<div class="panel-heading"><div><h2>Case ${escapeHtml(item.id)}</h2><p>Supervisor case record</p></div><span class="status-pill ${item.status === 'Resolved' ? 'resolved' : item.status === 'In review' ? 'review' : 'open'}">${escapeHtml(item.status)}</span></div><div class="escalation-detail-content"><h3>${escapeHtml(item.reason)}</h3><div class="escalation-facts"><div class="fact-box"><span>Customer</span><strong>${escapeHtml(item.customer)}</strong></div><div class="fact-box"><span>Agent</span><strong>${escapeHtml(item.agent)}</strong></div><div class="fact-box"><span>Priority</span><strong>${escapeHtml(item.priority)}</strong></div><div class="fact-box"><span>Created</span><strong>${escapeHtml(item.created)}</strong></div></div><label class="form-label">Case owner<select class="field" id="escalation-detail-owner"><option ${item.owner === 'Maryam Bello' ? 'selected' : ''}>Maryam Bello</option><option ${item.owner === 'Samuel Garba' ? 'selected' : ''}>Samuel Garba</option><option ${item.owner === 'Unassigned' ? 'selected' : ''}>Unassigned</option></select></label><label class="form-label">Status<select class="field" id="escalation-detail-status"><option ${item.status === 'Open' ? 'selected' : ''}>Open</option><option ${item.status === 'In review' ? 'selected' : ''}>In review</option><option ${item.status === 'Resolved' ? 'selected' : ''}>Resolved</option></select></label><label class="form-label">Resolution / next action<textarea class="field textarea" id="escalation-resolution" rows="3" placeholder="Record investigation outcome, customer update and owner action.">${escapeHtml(item.resolution)}</textarea></label><button class="button primary" data-action="save-escalation-update">Save case update</button></div>`;
  }
  function renderTeam() {
    $('#team-count').textContent = `${state.agents.length} AGENTS`;
    $('#team-table-body').innerHTML = state.agents.map((agent) => `<tr><td><div class="agent-cell"><div class="avatar">${escapeHtml(initials(agent.name))}</div><div><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.id)}</small></div></div></td><td>${escapeHtml(agent.team)}<br><small style="color:#7189a2">${escapeHtml(agent.skill)}</small></td><td><span class="status-pill ${agent.status === 'Available' ? 'completed' : agent.status === 'Wrap-up' ? 'review' : 'delivered'}">${escapeHtml(agent.status)}</span></td><td>${escapeHtml(agent.handled)}</td><td><div class="bar-cell"><span>${escapeHtml(agent.qa)}%</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.max(0,Math.min(100,agent.qa))}%"></span></span></div></td><td>${escapeHtml(agent.adherence)}%</td><td>${escapeHtml(agent.supervisor)}</td></tr>`).join('');
  }
  function renderCurrentView() {
    updateGlobalCounts();
    if (currentView === 'overview') renderOverview();
    if (currentView === 'monitoring') renderInteractionList();
    if (currentView === 'quality') { renderQaForm(); renderQaHistory(); }
    if (currentView === 'coaching') renderCoaching();
    if (currentView === 'escalations') renderEscalations();
    if (currentView === 'team') renderTeam();
  }

  $$('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#reset-demo').addEventListener('click', () => {
    if (!window.confirm('Reset this browser’s CALLORIA v4.7 supervisor demo data? Saved evaluations and coaching records will be cleared.')) return;
    state = Engine.createInitialState(); selectedInteractionId = state.interactions[0] ? state.interactions[0].id : null; selectedEscalationId = null; persist(); renderCurrentView(); toast('Demo data reset.');
  });
  ['interaction-search','channel-filter','status-filter','priority-filter'].forEach((id) => $('#' + id).addEventListener('input', renderInteractionList));
  $('#interaction-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-interaction-id]');
    if (!button) return;
    selectedInteractionId = button.dataset.interactionId;
    renderInteractionList();
  });
  $('#interaction-detail').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = interactionById(selectedInteractionId);
    if (!item) return;
    const action = button.dataset.action;
    if (action === 'monitor-contact') {
      item.monitored = true;
      Engine.addActivity(state, `Supervisor monitoring started for ${item.id}.`);
      persist(); renderInteractionDetail(); toast('Monitoring flag saved for this demo interaction.');
    } else if (action === 'request-support') {
      item.assistance = true;
      Engine.addActivity(state, `Supervisor assistance requested for ${item.id} (${item.agent}).`);
      persist(); renderInteractionDetail(); toast('Supervisor support request recorded.');
    } else if (action === 'raise-escalation') {
      const existing = state.escalations.find((entry) => entry.interactionId === item.id && entry.status !== 'Resolved');
      if (existing) { selectedEscalationId = existing.id; setView('escalations'); }
      else {
        $('#escalation-interaction-id').value = item.id;
        $('#escalation-reason').value = '';
        $('#escalation-priority').value = item.priority;
        $('#escalation-owner').value = 'Maryam Bello';
        $('#escalation-modal').showModal();
      }
    } else if (action === 'complete-contact') {
      item.status = 'Completed';
      Engine.addActivity(state, `${item.channel} interaction ${item.id} marked completed by supervisor.`);
      persist(); renderInteractionList(); toast('Interaction marked completed. It is now available for QA evaluation.');
    }
  });
  $('#escalation-form').addEventListener('submit', (event) => {
    if (event.submitter && event.submitter.value === 'cancel') return;
    event.preventDefault();
    const interaction = interactionById($('#escalation-interaction-id').value);
    if (!interaction) return toast('The selected interaction no longer exists.', 'error');
    const duplicate = state.escalations.find((item) => item.interactionId === interaction.id && item.status !== 'Resolved');
    if (duplicate) { $('#escalation-modal').close(); selectedEscalationId = duplicate.id; setView('escalations'); return toast('An open escalation already exists for this contact.'); }
    const escalation = Engine.createEscalation({ interactionId: interaction.id, agent: interaction.agent, customer: interaction.customer, reason: $('#escalation-reason').value, priority: $('#escalation-priority').value, owner: $('#escalation-owner').value });
    state.escalations.unshift(escalation);
    interaction.escalationId = escalation.id;
    Engine.addActivity(state, `Escalation ${escalation.id} opened for ${interaction.id}.`);
    persist(); $('#escalation-modal').close(); selectedEscalationId = escalation.id; setView('escalations'); toast(`Escalation ${escalation.id} created.`);
  });
  $('#qa-criteria').addEventListener('click', (event) => {
    const button = event.target.closest('[data-criterion]');
    if (!button) return;
    qaRatings[button.dataset.criterion] = Number(button.dataset.rating);
    renderQaForm();
  });
  $('#qa-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const interaction = interactionById($('#qa-interaction').value);
    if (!interaction) return toast('No eligible contact is available. Mark an interaction completed or move it to wrap-up first.', 'error');
    const evaluation = Engine.createEvaluation({ interactionId: interaction.id, agentId: interaction.agentId, agent: interaction.agent, channel: interaction.channel, evaluator: $('#qa-evaluator').value, notes: $('#qa-notes').value, responses: qaRatings });
    state.evaluations.push(evaluation);
    const agent = agentById(interaction.agentId);
    if (agent) agent.qa = evaluation.score;
    Engine.addActivity(state, `QA evaluation saved for ${interaction.agent} (${evaluation.score}%, ${evaluation.outcome}).`);
    persist(); $('#qa-notes').value = ''; qaRatings = Object.fromEntries(Engine.QA_CRITERIA.map((item) => [item.id, 3])); renderQaForm(); renderQaHistory(); toast(`QA evaluation saved: ${evaluation.score}% · ${evaluation.outcome}.`);
  });
  $('#coaching-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const agent = agentById($('#coaching-agent').value);
    if (!agent) return toast('Select an agent before saving.', 'error');
    const observed = $('#coaching-observed').value.trim();
    const action = $('#coaching-action').value.trim();
    if (!observed || !action || !$('#coaching-date').value) return toast('Complete the observation, agreed action and review date.', 'error');
    const entry = { id: `coach-${Date.now()}`, agentId: agent.id, agent: agent.name, focus: $('#coaching-focus').value, observed, action, reviewDate: $('#coaching-date').value, status: $('#coaching-status').value, created: new Date().toISOString() };
    state.coaching.push(entry); Engine.addActivity(state, `Coaching record created for ${agent.name}: ${entry.focus}.`); persist(); $('#coaching-observed').value = ''; $('#coaching-action').value = ''; renderCoaching(); toast('Coaching record saved.');
  });
  $('#coaching-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-coaching-action]');
    if (!button) return;
    const entry = state.coaching.find((item) => item.id === button.dataset.id);
    if (!entry) return;
    entry.status = button.dataset.coachingAction;
    Engine.addActivity(state, `Coaching record for ${entry.agent} marked ${entry.status.toLowerCase()}.`);
    persist(); renderCoaching(); toast(`Coaching record marked ${entry.status.toLowerCase()}.`);
  });
  $('#escalation-filter').addEventListener('change', renderEscalations);
  $('#escalation-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-escalation-id]');
    if (!button) return;
    selectedEscalationId = button.dataset.escalationId; renderEscalations();
  });
  $('#escalation-detail').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="save-escalation-update"]');
    if (!button) return;
    const entry = state.escalations.find((item) => item.id === selectedEscalationId);
    if (!entry) return;
    const nextStatus = $('#escalation-detail-status').value;
    const resolution = $('#escalation-resolution').value.trim();
    if (nextStatus === 'Resolved' && !resolution) return toast('Add a resolution or documented next action before resolving.', 'error');
    entry.owner = $('#escalation-detail-owner').value;
    entry.status = nextStatus;
    entry.resolution = resolution;
    Engine.addActivity(state, `Escalation ${entry.id} updated: ${entry.status} · owner ${entry.owner}.`);
    persist(); renderEscalations(); toast('Escalation record updated.');
  });

  const dateText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  $('#current-date').textContent = dateText;
  $('#coaching-date').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  renderCurrentView();
})();
