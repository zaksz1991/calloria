(function () {
  'use strict';
  const E = window.CalloriaReliabilityEngine;
  if (!E) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const storage = window.localStorage;
  let state = E.load(storage);
  let view = 'dashboard';
  let selectedId = null;
  let noticeTimer = null;

  const headings = {
    dashboard: ['Reliability control', 'Current incident exposure, response clocks and priority service scenarios.'],
    incidents: ['Incident register', 'Track ownership, severity, lifecycle status and response commitments.'],
    create: ['Report an incident', 'Record the signal, customer impact, affected service and response owner.'],
    maintenance: ['Planned maintenance', 'Schedule controlled work windows and record operational status.'],
    reviews: ['Post-incident reviews', 'Capture causes, lessons and accountable corrective actions.'],
    notices: ['Knowledge notices', 'Review published service notices shared with Knowledge Operations v5.2.'],
    detail: ['Incident command record', 'Manage the response, customer updates, tasks and review evidence.']
  };

  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
  function localDateTime(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function localDate(value) { if (!value) return '—'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); }
  function today() { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
  function productOptions(selected = 'general') { return E.PRODUCTS.map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); }
  function severityTag(severity) { const rank = E.SEVERITIES.indexOf(severity) + 1; return `<span class="tag sev${rank || 4}">${esc(severity)}</span>`; }
  function statusTag(status) { return `<span class="tag status-${esc(status.toLowerCase().replace(/\s+/g, '-'))}">${esc(status)}</span>`; }
  function notify(message, error = false) { const box = $('#notice'); box.textContent = message; box.hidden = false; box.classList.toggle('error', error); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { box.hidden = true; }, 5000); }
  function persist() { if (!E.save(state, storage)) notify('Browser storage is unavailable or full. Changes may not persist.', true); }
  function setView(next) { view = next; selectedId = null; render(); }
  function openIncident(id) { if (!E.getIncident(state, id)) return; selectedId = id; view = 'detail'; render(); }
  function metric(label, value, foot, tone = '') { return `<div class="metric-card ${tone}"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-foot">${esc(foot)}</div></div>`; }
  function renderMetrics() {
    const m = E.getMetrics(state, new Date());
    $('#metrics').innerHTML = [
      metric('Active incidents', m.active, 'Not yet resolved or closed'),
      metric('Critical · SEV 1', m.critical, 'Highest severity exposure', m.critical ? 'danger' : ''),
      metric('High · SEV 2', m.high, 'High severity exposure', m.high ? 'warn' : ''),
      metric('Overdue acknowledgement', m.overdueAcknowledgements, 'Against configured response target', m.overdueAcknowledgements ? 'danger' : ''),
      metric('Overdue customer update', m.overdueUpdates, 'Against configured update interval', m.overdueUpdates ? 'warn' : ''),
      metric('Reviews / maintenance', `${m.awaitingReview} / ${m.plannedMaintenance}`, 'Resolved reviews pending / planned work')
    ].join('');
  }
  function incidentRow(incident) {
    const sla = E.getSla(incident, new Date());
    const ackClass = sla.ack === 'Overdue' || sla.ack === 'Missed' ? 'sla-bad' : sla.ack === 'Met' ? 'sla-good' : 'sla-warn';
    const updateClass = sla.update === 'Overdue' ? 'sla-bad' : sla.update === 'On track' || sla.update === 'Stopped' ? 'sla-good' : 'sla-warn';
    return `<tr><td><button class="ref-link" type="button" data-open="${esc(incident.id)}">${esc(incident.reference)}</button><div class="subtext">${esc(incident.title)}</div></td><td>${esc(E.productName(incident.productId))}</td><td>${severityTag(incident.severity)}</td><td>${statusTag(incident.status)}</td><td>${esc(incident.owner)}</td><td><span class="${ackClass}">${esc(sla.ack)}</span><div class="subtext">Ack</div></td><td><span class="${updateClass}">${esc(sla.update)}</span><div class="subtext">Update</div></td></tr>`;
  }
  function renderTable(incidents, emptyText = 'No incidents are recorded.') {
    if (!incidents.length) return `<div class="empty-state">${esc(emptyText)}</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Reference / incident</th><th>Service</th><th>Severity</th><th>Status</th><th>Owner</th><th>Acknowledgement</th><th>Customer update</th></tr></thead><tbody>${incidents.map(incidentRow).join('')}</tbody></table></div>`;
  }
  function renderDashboard() {
    const active = state.incidents.filter((item) => !['Resolved', 'Closed'].includes(item.status)).sort((a, b) => E.SEVERITIES.indexOf(a.severity) - E.SEVERITIES.indexOf(b.severity) || a.detectedAt.localeCompare(b.detectedAt));
    const recent = state.activity.slice(0, 8);
    const scenarios = E.DEMO_SCENARIOS.map((scenario) => `<div class="scenario-card"><div class="scenario-meta">${severityTag(scenario.severity)}<span class="tag">${esc(E.productName(scenario.productId))}</span></div><h3>${esc(scenario.title)}</h3><p>${esc(scenario.summary)}</p><button class="button button-outline button-small" type="button" data-launch="${esc(scenario.id)}">Launch simulation incident</button></div>`).join('');
    const pushed = state.integration.noticePushes || 0;
    return `<div class="workspace-grid"><div><div class="panel"><div class="panel-head"><div><h2>Priority incident queue</h2><div class="panel-subtitle">Incidents requiring active coordination. SLA states recalculate when this page is refreshed.</div></div><button class="button button-outline button-small" type="button" data-goto="incidents">Full register</button></div>${renderTable(active.slice(0, 8), 'No active incidents. Launch a practice scenario or report a real simulated event.')}</div><div class="panel"><div class="panel-head"><div><h2>Operational activity</h2><div class="panel-subtitle">Recent changes recorded in this browser.</div></div><span class="tag">${state.activity.length} events</span></div>${recent.length ? `<div class="activity-list">${recent.map((item) => `<div class="activity-item"><i></i><div><p>${esc(item.message)}</p><small>${localDateTime(item.at)}</small></div></div>`).join('')}</div>` : '<div class="empty-state">No response activity has been recorded.</div>'}</div></div><div><div class="panel"><div class="panel-head"><div><h2>Practice incidents</h2><div class="panel-subtitle">Synthetic service situations. These do not describe live platform faults.</div></div></div><div class="scenario-list">${scenarios}</div></div><div class="panel"><div class="panel-head"><div><h2>Knowledge Operations bridge</h2><div class="panel-subtitle">Explicitly send an incident customer summary as a draft service notice to v5.2.</div></div></div><div class="detail-block"><p>${pushed} draft notice${pushed === 1 ? '' : 's'} sent from this workspace. Notices require review and publication in Knowledge Operations.</p></div><button class="button button-outline button-small" type="button" data-goto="notices">View published notices</button></div></div></div>`;
  }
  function renderIncidentRegister() {
    const incidents = state.incidents.slice().sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    return `<div class="panel"><div class="panel-head"><div><h2>Incident register</h2><div class="panel-subtitle">${incidents.length} incident record${incidents.length === 1 ? '' : 's'} in local storage.</div></div><div class="pill-row"><select id="incident-status-filter" class="button button-outline"><option value="">All statuses</option>${E.STATUSES.map((s) => `<option>${esc(s)}</option>`).join('')}</select><select id="incident-severity-filter" class="button button-outline"><option value="">All severity</option>${E.SEVERITIES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div></div><div id="incident-register-table">${renderTable(incidents)}</div><p class="small-note">Response targets are configurable demonstration thresholds. They are not contractual commitments or live monitoring.</p></div>`;
  }
  function renderCreate() {
    return `<div class="panel"><div class="panel-head"><div><h2>New incident record</h2><div class="panel-subtitle">Create a controlled incident record. Do not enter passwords, payment credentials or unnecessary personal information.</div></div><span class="tag">Initial status · Detected</span></div><form id="incident-form"><div class="form-grid"><div class="field"><label for="incident-title">Incident title *</label><input id="incident-title" name="title" required minlength="5" maxlength="140" placeholder="e.g. Sign-in failures affecting customer accounts"></div><div class="field"><label for="incident-product">Affected product / service *</label><select id="incident-product" name="productId">${productOptions()}</select></div><div class="field"><label for="incident-severity">Initial severity *</label><select id="incident-severity" name="severity">${E.SEVERITIES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div><div class="field"><label for="incident-category">Incident category *</label><select id="incident-category" name="category"><option>Service outage</option><option>Service degradation</option><option>Access disruption</option><option>Performance degradation</option><option>Security event</option><option>Data integrity</option><option>Third-party dependency</option><option>Other operational incident</option></select></div><div class="field"><label for="incident-owner">Response owner</label><input id="incident-owner" name="owner" maxlength="100" placeholder="Named incident lead or Unassigned"></div><div class="field"><label for="incident-reporter">Reported by</label><input id="incident-reporter" name="reporter" maxlength="100" value="Operations Control"></div><div class="field"><label for="incident-estimate">Estimated affected customers *</label><input id="incident-estimate" name="estimatedCustomers" type="number" min="0" max="100000000" step="1" value="0" required></div><div class="field"><label>Impacted contact channels *</label><div class="check-group">${E.CHANNELS.map((channel) => `<label><input type="checkbox" name="channels" value="${esc(channel)}" ${channel === 'Voice' ? 'checked' : ''}>${esc(channel)}</label>`).join('')}</div></div><div class="field full"><label for="incident-summary">What happened? *</label><textarea id="incident-summary" name="summary" minlength="40" maxlength="1200" required placeholder="Describe the observed behaviour, start time if known, scope and evidence. Minimum 40 characters."></textarea></div><div class="field full"><label for="incident-impact">Customer and operational impact</label><textarea id="incident-impact" name="impact" maxlength="1000" placeholder="Describe what customers cannot do and the consequences for operations."></textarea></div><div class="field full"><label for="incident-customer-summary">Customer-facing summary</label><textarea id="incident-customer-summary" name="customerSummary" maxlength="700" placeholder="A factual, safe summary suitable for a reviewed customer service notice."></textarea><span class="field-hint">Do not invent an estimated restoration time. Use “Not confirmed” until an estimate is evidence-based.</span></div><div class="field full"><label for="incident-signal">Detection signal / evidence</label><textarea id="incident-signal" name="signal" maxlength="500" placeholder="Synthetic report pattern, verified monitoring evidence or case references without customer secrets."></textarea></div></div><div class="form-actions"><button class="button button-outline" type="button" data-goto="dashboard">Cancel</button><button class="button button-primary" type="submit">Create incident record</button></div></form></div>`;
  }
  function renderIncidentDetail(incident) {
    const sla = E.getSla(incident, new Date());
    const allowed = incident.status === 'Detected' ? [] : (E.TRANSITIONS[incident.status] || []);
    const updates = incident.updates || [];
    const tasks = incident.tasks || [];
    const canPush = ['Mitigating', 'Monitoring', 'Resolved'].includes(incident.status);
    const postmortem = incident.postmortem;
    const responseControls = ['Resolved', 'Closed'].includes(incident.status) ? `<div class="detail-block"><h3>Response controls</h3><p>Ownership and severity are locked after resolution.</p></div>` : `<div class="detail-block"><h3>Response controls</h3><div class="form-grid"><form id="assign-form"><div class="field"><label for="assign-owner">Incident owner</label><input id="assign-owner" name="owner" value="${esc(incident.owner)}" required><button class="button button-outline button-small" type="submit">Update owner</button></div></form><form id="severity-form"><div class="field"><label for="change-severity">Severity</label><select id="change-severity" name="severity">${E.SEVERITIES.map((s) => `<option ${s === incident.severity ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><input name="reason" required minlength="15" placeholder="Reason for severity decision"><button class="button button-outline button-small" type="submit">Update severity</button></div></form></div></div>`;
    const reviewForm = ['Resolved', 'Closed'].includes(incident.status) && !postmortem ? `<div class="panel"><div class="panel-head"><div><h2>Finalise post-incident review</h2><div class="panel-subtitle">Required before an incident can be closed. Record causes and at least one owned, dated action.</div></div></div><form id="postmortem-form"><div class="form-grid"><div class="field"><label for="pir-impact">Impact summary *</label><textarea id="pir-impact" name="impactSummary" required minlength="20"></textarea></div><div class="field"><label for="pir-root">Root cause *</label><textarea id="pir-root" name="rootCause" required minlength="20"></textarea></div><div class="field"><label for="pir-factors">Contributing factors</label><textarea id="pir-factors" name="contributingFactors"></textarea></div><div class="field"><label for="pir-went-well">What went well</label><textarea id="pir-went-well" name="whatWentWell"></textarea></div><div class="field"><label for="pir-improvements">What must improve *</label><textarea id="pir-improvements" name="improvements" required minlength="20"></textarea></div><div class="field"><label for="pir-reviewer">Review owner *</label><input id="pir-reviewer" name="reviewer" required minlength="2" value="Service Reliability Lead"></div><div class="field"><label for="pir-action-title">Follow-up action *</label><input id="pir-action-title" name="actionTitle" required minlength="5" placeholder="Preventive action or control improvement"></div><div class="field"><label for="pir-action-owner">Action owner *</label><input id="pir-action-owner" name="actionOwner" required minlength="2"></div><div class="field"><label for="pir-action-due">Action due date *</label><input id="pir-action-due" name="actionDueDate" type="date" required value="${today()}"></div></div><div class="form-actions"><button class="button button-primary" type="submit">Save completed review</button></div></form></div>` : '';
    return `<div class="panel"><div class="detail-top"><div><div class="detail-meta"><span class="tag">${esc(incident.reference)}</span>${severityTag(incident.severity)}${statusTag(incident.status)}<span class="tag">${esc(E.productName(incident.productId))}</span></div><h2>${esc(incident.title)}</h2><div class="panel-subtitle">Detected ${localDateTime(incident.detectedAt)} · Owner: ${esc(incident.owner)}</div></div><div class="heading-actions"><button class="button button-outline button-small" type="button" data-goto="incidents">Back to register</button>${incident.status === 'Detected' ? `<button class="button button-primary button-small" type="button" data-acknowledge="${esc(incident.id)}">Acknowledge incident</button>` : ''}${canPush ? `<button class="button button-primary button-small" type="button" data-push-notice="${esc(incident.id)}">Create Knowledge Ops draft</button>` : ''}</div></div><div class="divider"></div><div class="detail-grid"><div><div class="detail-block"><h3>Incident summary</h3><p>${esc(incident.summary)}</p></div><div class="detail-block"><h3>Customer and operational impact</h3><p>${esc(incident.impact || 'Not recorded.')}</p><p class="small-note">Estimated affected customers: ${esc(incident.estimatedCustomers)} · Channels: ${esc((incident.channels || []).join(', '))}</p></div>${responseControls}${allowed.length ? `<div class="detail-block"><h3>Lifecycle transition</h3><form id="transition-form"><div class="form-grid"><div class="field"><label for="next-status">Move to next status</label><select id="next-status" name="status">${allowed.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div><div class="field"><label for="resolution-summary">Resolution summary (required when resolving)</label><input id="resolution-summary" name="resolution" placeholder="Evidence-backed fix and verification"></div></div><div class="form-actions"><button class="button button-primary button-small" type="submit">Apply transition</button></div></form></div>` : '<div class="detail-block"><h3>Lifecycle</h3><p>This incident has reached its final state.</p></div>'}<div class="detail-block"><h3>Customer and internal updates</h3>${updates.length ? updates.map((u) => `<div class="update-card"><div class="detail-meta"><span class="tag">${esc(u.audience)}</span><span class="tag">${esc(u.eta || 'No ETA')}</span></div><p>${esc(u.message)}</p><small>${localDateTime(u.at)} · ${esc((u.channels || []).join(', ') || 'No channel specified')}</small></div>`).join('') : '<div class="empty-state">No updates recorded.</div>'}${!['Resolved', 'Closed'].includes(incident.status) ? `<form id="update-form"><div class="form-grid"><div class="field"><label for="update-audience">Audience</label><select id="update-audience" name="audience"><option>Customer-facing</option><option>Internal operations</option><option>Leadership</option></select></div><div class="field"><label for="update-eta">Restoration / next update estimate</label><input id="update-eta" name="eta" maxlength="80" placeholder="Not confirmed"></div><div class="field full"><label for="update-message">Update message *</label><textarea id="update-message" name="message" required minlength="30" placeholder="State confirmed facts, current action and next update expectation."></textarea></div><div class="field full"><label>Channels for this update</label><div class="check-group">${E.CHANNELS.map((c) => `<label><input type="checkbox" name="channels" value="${esc(c)}" ${c === 'All channels' ? 'checked' : ''}>${esc(c)}</label>`).join('')}</div></div></div><div class="form-actions"><button class="button button-outline button-small" type="submit">Record update</button></div></form>` : ''}</div><div class="detail-block"><h3>Follow-up tasks</h3>${tasks.length ? tasks.map((task) => `<div class="task-row"><div><strong>${esc(task.title)}</strong><small>${esc(task.owner)} · Due ${localDate(task.dueDate)} · ${esc(task.status)}</small></div>${task.status !== 'Complete' ? `<button class="button button-outline button-small" type="button" data-complete-task="${esc(task.id)}">Complete</button>` : '<span class="tag complete">Complete</span>'}</div>`).join('') : '<div class="empty-state">No follow-up tasks recorded.</div>'}${!['Closed'].includes(incident.status) ? `<form id="task-form"><div class="form-grid"><div class="field"><label for="task-title">Task</label><input id="task-title" name="title" required minlength="5"></div><div class="field"><label for="task-owner">Owner</label><input id="task-owner" name="owner" required minlength="2"></div><div class="field"><label for="task-due">Due date</label><input id="task-due" name="dueDate" type="date" value="${today()}" required></div></div><div class="form-actions"><button class="button button-outline button-small" type="submit">Add follow-up task</button></div></form>` : ''}</div>${postmortem ? `<div class="detail-block"><h3>Post-incident review</h3><p><strong>Root cause:</strong> ${esc(postmortem.rootCause)}</p><p><strong>Impact:</strong> ${esc(postmortem.impactSummary)}</p><p><strong>Improvements:</strong> ${esc(postmortem.improvements)}</p><p class="small-note">Reviewed by ${esc(postmortem.reviewer)} · ${localDateTime(postmortem.completedAt)}</p>${postmortem.actions.map((a) => `<div class="task-row"><div><strong>${esc(a.title)}</strong><small>${esc(a.owner)} · Due ${localDate(a.dueDate)}</small></div><span class="tag">${esc(a.status)}</span></div>`).join('')}</div>` : ''}</div><div><div class="panel"><div class="panel-head"><div><h2>Response clocks</h2><div class="panel-subtitle">Calculated from record timestamps and current severity.</div></div></div><div class="sla-row"><span>Acknowledgement target</span><strong>${sla.acknowledgeMinutes} minutes</strong></div><div class="sla-row"><span>Acknowledgement status</span><strong class="${sla.ack === 'Overdue' || sla.ack === 'Missed' ? 'sla-bad' : sla.ack === 'Met' ? 'sla-good' : 'sla-warn'}">${esc(sla.ack)}</strong></div><div class="sla-row"><span>Customer update interval</span><strong>${sla.updateMinutes} minutes</strong></div><div class="sla-row"><span>Customer update status</span><strong class="${sla.update === 'Overdue' ? 'sla-bad' : sla.update === 'On track' || sla.update === 'Stopped' ? 'sla-good' : 'sla-warn'}">${esc(sla.update)}</strong></div><div class="sla-row"><span>Incident age</span><strong>${sla.ageMinutes} min</strong></div><div class="small-note">Acknowledge / update targets are example operational controls. The browser does not run a background alert service.</div></div><div class="panel"><div class="panel-head"><div><h2>Response timeline</h2><div class="panel-subtitle">Auditable changes recorded in this browser.</div></div></div><div class="timeline">${(incident.timeline || []).map((entry) => `<div class="timeline-entry"><strong>${esc(entry.type)}</strong><p>${esc(entry.text)}</p><small>${localDateTime(entry.at)}</small></div>`).join('')}</div></div></div></div></div>${reviewForm}`;
  }
  function renderMaintenance() {
    const list = state.maintenance.slice().sort((a, b) => a.startAt.localeCompare(b.startAt));
    return `<div class="workspace-grid"><div class="panel"><div class="panel-head"><div><h2>Schedule a maintenance window</h2><div class="panel-subtitle">Record owner, service impact and start/end window. This does not trigger a deployment or notify customers.</div></div></div><form id="maintenance-form"><div class="form-grid"><div class="field full"><label for="maint-title">Maintenance title *</label><input id="maint-title" name="title" required minlength="5" maxlength="140" placeholder="e.g. Planned database maintenance"></div><div class="field"><label for="maint-product">Service *</label><select id="maint-product" name="productId">${productOptions()}</select></div><div class="field"><label for="maint-owner">Owner *</label><input id="maint-owner" name="owner" required minlength="2"></div><div class="field"><label for="maint-start">Start *</label><input id="maint-start" name="startAt" type="datetime-local" required></div><div class="field"><label for="maint-end">End *</label><input id="maint-end" name="endAt" type="datetime-local" required></div><div class="field full"><label for="maint-impact">Expected customer impact</label><textarea id="maint-impact" name="customerImpact" maxlength="500"></textarea></div></div><div class="form-actions"><button class="button button-primary" type="submit">Save maintenance window</button></div></form></div><div class="panel"><div class="panel-head"><div><h2>Maintenance register</h2><div class="panel-subtitle">${list.length} planned and historical work window(s).</div></div></div>${list.length ? list.map((item) => `<div class="notice-row"><div class="detail-meta"><span class="tag">${esc(item.status)}</span><span class="tag">${esc(E.productName(item.productId))}</span></div><h3>${esc(item.title)}</h3><p>${localDateTime(item.startAt)} – ${localDateTime(item.endAt)} · Owner: ${esc(item.owner)}</p><p>${esc(item.customerImpact || 'No impact summary recorded.')}</p><div class="form-actions">${item.status === 'Planned' ? `<button class="button button-outline button-small" type="button" data-maintenance-status="${esc(item.id)}" data-next="In progress">Start</button><button class="button button-outline button-small" type="button" data-maintenance-status="${esc(item.id)}" data-next="Cancelled">Cancel</button>` : ''}${item.status === 'In progress' ? `<button class="button button-primary button-small" type="button" data-maintenance-status="${esc(item.id)}" data-next="Completed">Mark completed</button>` : ''}</div></div>`).join('') : '<div class="empty-state">No maintenance windows are scheduled.</div>'}</div></div>`;
  }
  function renderReviews() {
    const items = state.incidents.filter((item) => ['Resolved', 'Closed'].includes(item.status)).sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || ''));
    return `<div class="panel"><div class="panel-head"><div><h2>Resolved incident review queue</h2><div class="panel-subtitle">A resolved incident cannot be closed until its post-incident review and at least one follow-up action are recorded.</div></div><span class="tag">${items.filter((x) => !x.postmortem).length} awaiting review</span></div>${items.length ? `<div class="table-wrap"><table><thead><tr><th>Incident</th><th>Service</th><th>Severity</th><th>Resolved</th><th>Review</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${esc(item.reference)}</strong><div class="subtext">${esc(item.title)}</div></td><td>${esc(E.productName(item.productId))}</td><td>${severityTag(item.severity)}</td><td>${localDateTime(item.resolvedAt)}</td><td>${item.postmortem ? '<span class="tag complete">Reviewed</span>' : '<span class="tag important">Review required</span>'}</td><td><button class="button button-outline button-small" type="button" data-open="${esc(item.id)}">Open review</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No incidents have been resolved yet.</div>'}</div>`;
  }
  function renderNotices() {
    const notices = E.listKnowledgeNotices(storage);
    state.integration.lastKnowledgeReadAt = new Date().toISOString();
    return `<div class="panel"><div class="panel-head"><div><h2>Published Knowledge Operations notices</h2><div class="panel-subtitle">Read-only view of v5.2 notices in the same browser origin. Drafts are intentionally excluded.</div></div><span class="tag">${notices.length} published</span></div>${notices.length ? notices.map((notice) => `<div class="notice-row"><div class="detail-meta"><span class="tag ${notice.severity === 'Critical' ? 'critical' : notice.severity === 'Important' ? 'important' : 'info'}">${esc(notice.severity)}</span><span class="tag">${esc(E.productName(notice.productId))}</span><span class="tag">Effective ${esc(notice.effectiveAt)}</span></div><h3>${esc(notice.title)}</h3><p>${esc(notice.summary)}</p><p class="small-note">Published ${esc(notice.publishedAt || 'date not recorded')} · Audience: ${esc(notice.audience)}</p></div>`).join('') : '<div class="empty-state">No published v5.2 service notices were found. Open Knowledge Operations v5.2, save a notice and publish it. Then return here and refresh.</div>'}<div class="small-note">This page does not subscribe to live updates. Refresh the view after publishing a notice in Knowledge Operations.</div></div>`;
  }
  function render() {
    const heading = headings[view] || headings.dashboard;
    $('#page-title').textContent = heading[0]; $('#page-subtitle').textContent = heading[1];
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view || (view === 'detail' && button.dataset.view === 'incidents')));
    renderMetrics();
    let html = '';
    if (view === 'dashboard') html = renderDashboard();
    else if (view === 'incidents') html = renderIncidentRegister();
    else if (view === 'create') html = renderCreate();
    else if (view === 'maintenance') html = renderMaintenance();
    else if (view === 'reviews') html = renderReviews();
    else if (view === 'notices') html = renderNotices();
    else if (view === 'detail') { const incident = E.getIncident(state, selectedId); if (incident) html = renderIncidentDetail(incident); else { view = 'incidents'; html = renderIncidentRegister(); } }
    $('#workspace').innerHTML = html;
  }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function download(filename, content, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
  function applyIncidentFilters() {
    const status = $('#incident-status-filter')?.value || ''; const severity = $('#incident-severity-filter')?.value || '';
    const selected = state.incidents.filter((item) => (!status || item.status === status) && (!severity || item.severity === severity)).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    const target = $('#incident-register-table'); if (target) target.innerHTML = renderTable(selected, 'No incidents match the selected filters.');
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.view) { setView(target.dataset.view); return; }
    if (target.dataset.goto) { setView(target.dataset.goto); return; }
    if (target.id === 'new-incident') { setView('create'); return; }
    if (target.id === 'export-incidents') { download('calloria-incident-register-v53.csv', E.exportIncidentsCSV(state)); return; }
    if (target.dataset.open) { openIncident(target.dataset.open); return; }
    if (target.dataset.launch) {
      try { const incident = E.launchScenario(state, target.dataset.launch); persist(); notify(`${incident.reference} simulation incident created. It is synthetic, not a live fault.`); openIncident(incident.id); }
      catch (error) { notify(error.message, true); }
      return;
    }
    if (target.dataset.acknowledge) {
      try { const incident = E.getIncident(state, target.dataset.acknowledge); E.acknowledgeIncident(state, incident.id, incident.owner); persist(); render(); notify('Incident acknowledged. Response clock is recorded.'); }
      catch (error) { notify(error.message, true); }
      return;
    }
    if (target.dataset.pushNotice) {
      try { const result = E.pushKnowledgeNotice(state, target.dataset.pushNotice, storage); persist(); render(); notify(result.created ? 'Draft service notice sent to Knowledge Operations v5.2. Review and publish it there.' : 'A Knowledge Operations draft already exists for this incident.'); }
      catch (error) { notify(error.message, true); }
      return;
    }
    if (target.dataset.completeTask) {
      try { E.completeTask(state, selectedId, target.dataset.completeTask); persist(); render(); notify('Follow-up task marked complete.'); }
      catch (error) { notify(error.message, true); }
      return;
    }
    if (target.dataset.maintenanceStatus) {
      try { E.setMaintenanceStatus(state, target.dataset.maintenanceStatus, target.dataset.next); persist(); render(); notify(`Maintenance marked ${target.dataset.next.toLowerCase()}.`); }
      catch (error) { notify(error.message, true); }
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'incident-status-filter' || event.target.id === 'incident-severity-filter') applyIncidentFilters();
  });

  document.addEventListener('submit', (event) => {
    const form = event.target; if (!form.id) return; event.preventDefault();
    try {
      if (form.id === 'incident-form') {
        const data = formObject(form); data.channels = new FormData(form).getAll('channels'); data.estimatedCustomers = Number(data.estimatedCustomers);
        const incident = E.createIncident(state, data); persist(); notify(`${incident.reference} created. Acknowledge and assign an owner to start the response.`); openIncident(incident.id); return;
      }
      if (form.id === 'assign-form') { E.assignOwner(state, selectedId, formObject(form).owner); persist(); render(); notify('Incident ownership updated.'); return; }
      if (form.id === 'severity-form') { E.changeSeverity(state, selectedId, formObject(form).severity, formObject(form).reason); persist(); render(); notify('Severity decision recorded.'); return; }
      if (form.id === 'transition-form') { const data = formObject(form); E.transitionIncident(state, selectedId, data.status, data.resolution); persist(); render(); notify(`Incident moved to ${data.status}.`); return; }
      if (form.id === 'update-form') { const data = formObject(form); data.channels = new FormData(form).getAll('channels'); E.addUpdate(state, selectedId, data); persist(); render(); notify('Incident update recorded. No customer message was sent.'); return; }
      if (form.id === 'task-form') { E.addTask(state, selectedId, formObject(form)); persist(); render(); notify('Follow-up task added.'); return; }
      if (form.id === 'postmortem-form') {
        const data = formObject(form); data.actions = [{ title: data.actionTitle, owner: data.actionOwner, dueDate: data.actionDueDate }];
        E.savePostmortem(state, selectedId, data); persist(); render(); notify('Post-incident review saved. The incident can now be closed through its lifecycle controls.'); return;
      }
      if (form.id === 'maintenance-form') { E.createMaintenance(state, formObject(form)); persist(); render(); notify('Maintenance window saved. No deployment or notification was triggered.'); return; }
    } catch (error) { notify(error && error.message ? error.message : 'The requested operation could not be completed.', true); }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === E.KNOWLEDGE_KEY && view === 'notices') render();
    if (event.key === E.STORAGE_KEY) { state = E.load(storage); render(); }
  });

  render();
})();
