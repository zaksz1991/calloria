(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaReliabilityEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.3.0';
  const STORAGE_KEY = 'calloria.service-reliability.v53';
  const KNOWLEDGE_KEY = 'calloria.knowledge-operations.v52';
  const PRODUCTS = [
    { id: 'general', name: 'General customer service' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
    { id: 'kano-run', name: 'Kano Run' },
    { id: 'kano-keke', name: 'Kano Keke' }
  ];
  const SEVERITIES = ['SEV 1 - Critical', 'SEV 2 - High', 'SEV 3 - Moderate', 'SEV 4 - Low'];
  const STATUSES = ['Detected', 'Triaged', 'Investigating', 'Mitigating', 'Monitoring', 'Resolved', 'Closed'];
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app', 'All channels'];
  const SLA = {
    'SEV 1 - Critical': { acknowledgeMinutes: 15, updateMinutes: 30 },
    'SEV 2 - High': { acknowledgeMinutes: 30, updateMinutes: 60 },
    'SEV 3 - Moderate': { acknowledgeMinutes: 240, updateMinutes: 240 },
    'SEV 4 - Low': { acknowledgeMinutes: 480, updateMinutes: 480 }
  };
  const TRANSITIONS = {
    Detected: [], Triaged: ['Investigating'], Investigating: ['Mitigating'],
    Mitigating: ['Monitoring'], Monitoring: ['Resolved'], Resolved: ['Closed'], Closed: []
  };
  const DEMO_SCENARIOS = [
    { id: 'lms-enrolment', title: 'LMS enrolment failures', productId: 'ruffneck-lms', severity: 'SEV 2 - High', category: 'Service degradation', summary: 'A simulated rise in course-enrolment failures is affecting customers attempting to join learning programmes.', impact: 'Customers can sign in, but some enrolment requests fail before confirmation.', estimatedCustomers: 180, channels: ['Voice', 'Email', 'Live chat'], signal: 'Synthetic contact spike and repeated enrolment error reports.' },
    { id: 'connect-latency', title: 'Connect intermittent latency', productId: 'ruffneck-connect', severity: 'SEV 3 - Moderate', category: 'Performance degradation', summary: 'A simulated intermittent delay is affecting connection setup for a portion of users.', impact: 'Some users experience a longer setup process and may retry.', estimatedCustomers: 65, channels: ['Email', 'Live chat', 'Social'], signal: 'Synthetic latency reports across multiple sessions.' },
    { id: 'kano-login', title: 'Kano Run login disruption', productId: 'kano-run', severity: 'SEV 2 - High', category: 'Access disruption', summary: 'A simulated login disruption is preventing some players from reaching the game.', impact: 'Affected players cannot complete the sign-in flow. Game activity statistics are not available in this scenario.', estimatedCustomers: 240, channels: ['Social', 'Email', 'In-app'], signal: 'Synthetic player reports and repeated login failures.' }
  ];

  function clean(value, max = 800) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function validDate(value) { return !Number.isNaN(new Date(value).getTime()); }
  function isoNow(value) { const d = value instanceof Date ? value : new Date(value || Date.now()); if (!validDate(d)) throw new Error('Enter a valid date and time.'); return d.toISOString(); }
  function productName(id) { return (PRODUCTS.find((p) => p.id === id) || PRODUCTS[0]).name; }
  function severityRank(value) { return SEVERITIES.indexOf(value); }
  function createInitialState() {
    return { version: VERSION, incidents: [], maintenance: [], activity: [], integration: { knowledgeKey: KNOWLEDGE_KEY, lastKnowledgeReadAt: null, lastNoticePushAt: null, noticePushes: 0 } };
  }
  function normaliseState(raw) {
    const fresh = createInitialState();
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
      maintenance: Array.isArray(raw.maintenance) ? raw.maintenance : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      integration: { ...fresh.integration, ...(raw.integration || {}) }
    };
  }
  function load(target) {
    if (!target || typeof target.getItem !== 'function') return createInitialState();
    try { const raw = JSON.parse(target.getItem(STORAGE_KEY) || 'null'); return raw ? normaliseState(raw) : createInitialState(); }
    catch (_) { return createInitialState(); }
  }
  function save(state, target) {
    if (!target || typeof target.setItem !== 'function') return false;
    try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function activity(state, message, at) {
    state.activity.unshift({ id: makeId('rel-act'), at: isoNow(at), message: clean(message, 260) });
    state.activity = state.activity.slice(0, 200);
  }
  function getIncident(state, id) { return state.incidents.find((item) => item.id === id) || null; }
  function validateIncident(input) {
    if (!input || clean(input.title, 140).length < 5) throw new Error('Incident title must contain at least five characters.');
    if (!PRODUCTS.some((product) => product.id === input.productId)) throw new Error('Choose a valid affected product or service.');
    if (!SEVERITIES.includes(input.severity)) throw new Error('Choose a valid severity.');
    if (clean(input.category, 60).length < 3) throw new Error('Choose an incident category.');
    if (clean(input.summary, 40).length < 40) throw new Error('Incident summary must contain at least 40 characters.');
    const estimate = Number(input.estimatedCustomers);
    if (!Number.isInteger(estimate) || estimate < 0 || estimate > 100000000) throw new Error('Estimated affected customers must be a whole number from 0 to 100,000,000.');
    const channels = Array.isArray(input.channels) ? input.channels.filter((channel) => CHANNELS.includes(channel)) : [];
    if (!channels.length) throw new Error('Select at least one affected contact channel.');
    return {
      title: clean(input.title, 140), productId: input.productId, severity: input.severity,
      category: clean(input.category, 60), summary: clean(input.summary, 1200),
      impact: clean(input.impact, 1000), estimatedCustomers: estimate, channels,
      owner: clean(input.owner || 'Unassigned', 100), reporter: clean(input.reporter || 'Operations Control', 100),
      signal: clean(input.signal || '', 500), customerSummary: clean(input.customerSummary || '', 700)
    };
  }
  function createIncident(state, input, at) {
    const fields = validateIncident(input);
    const now = isoNow(at);
    const incident = {
      id: makeId('INC'), reference: `INC-${new Date(now).getUTCFullYear()}-${Math.random().toString(10).slice(2, 8).padEnd(6, '0')}`,
      ...fields, status: 'Detected', detectedAt: now, acknowledgedAt: null, resolvedAt: null, closedAt: null,
      updates: [], tasks: [], timeline: [{ id: makeId('evt'), at: now, type: 'created', text: 'Incident detected and record opened.' }],
      postmortem: null, sourceScenario: input.sourceScenario || null, sourceKnowledgeNoticeId: null
    };
    state.incidents.unshift(incident);
    activity(state, `${incident.reference} opened: ${incident.title}.`, now);
    return incident;
  }
  function launchScenario(state, scenarioId, at) {
    const scenario = DEMO_SCENARIOS.find((item) => item.id === scenarioId);
    if (!scenario) throw new Error('Demo incident scenario not found.');
    return createIncident(state, { ...scenario, reporter: 'CALLORIA simulation scenario', owner: 'Unassigned', customerSummary: scenario.impact, sourceScenario: scenario.id }, at);
  }
  function appendTimeline(incident, type, text, at) {
    incident.timeline.unshift({ id: makeId('evt'), at: isoNow(at), type: clean(type, 30), text: clean(text, 500) });
    incident.timeline = incident.timeline.slice(0, 120);
  }
  function acknowledgeIncident(state, id, owner, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (incident.acknowledgedAt) throw new Error('Incident has already been acknowledged.');
    if (incident.status !== 'Detected') throw new Error('Only a newly detected incident can be acknowledged.');
    const assignedOwner = clean(owner || incident.owner, 100);
    if (assignedOwner.length < 2 || assignedOwner.toLowerCase() === 'unassigned') throw new Error('Assign a named incident owner before acknowledgement.');
    const now = isoNow(at); incident.acknowledgedAt = now; incident.status = 'Triaged'; incident.owner = assignedOwner;
    appendTimeline(incident, 'acknowledged', `Acknowledged by ${incident.owner}.`, now);
    activity(state, `${incident.reference} acknowledged by ${incident.owner}.`, now);
    return incident;
  }
  function assignOwner(state, id, owner, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (['Resolved', 'Closed'].includes(incident.status)) throw new Error('Ownership is locked after incident resolution.');
    const next = clean(owner, 100); if (next.length < 2 || next.toLowerCase() === 'unassigned') throw new Error('Assign a named incident owner.')
    const previous = incident.owner; incident.owner = next;
    appendTimeline(incident, 'assignment', `Ownership changed from ${previous} to ${next}.`, at);
    activity(state, `${incident.reference} assigned to ${next}.`, at); return incident;
  }
  function transitionIncident(state, id, nextStatus, resolution, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (!STATUSES.includes(nextStatus) || !(TRANSITIONS[incident.status] || []).includes(nextStatus)) throw new Error(`Invalid lifecycle transition from ${incident.status} to ${nextStatus}.`);
    const now = isoNow(at);
    if (nextStatus === 'Resolved' && clean(resolution, 30).length < 30) throw new Error('Add a resolution summary of at least 30 characters before resolving.');
    if (nextStatus === 'Closed' && (!incident.postmortem || !incident.postmortem.completedAt || !incident.postmortem.actions.length)) throw new Error('Complete the post-incident review and add at least one follow-up action before closing.');
    const previous = incident.status; incident.status = nextStatus;
    if (nextStatus === 'Resolved') { incident.resolvedAt = now; incident.resolution = clean(resolution, 1200); }
    if (nextStatus === 'Closed') incident.closedAt = now;
    appendTimeline(incident, 'status', `Status changed from ${previous} to ${nextStatus}.${nextStatus === 'Resolved' ? ` Resolution: ${incident.resolution}` : ''}`, now);
    activity(state, `${incident.reference} moved to ${nextStatus}.`, now); return incident;
  }
  function changeSeverity(state, id, severity, reason, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (['Resolved', 'Closed'].includes(incident.status)) throw new Error('Severity is locked after incident resolution.');
    if (!SEVERITIES.includes(severity)) throw new Error('Choose a valid incident severity.');
    if (clean(reason, 15).length < 15) throw new Error('Record at least 15 characters explaining the severity decision.');
    const prior = incident.severity; incident.severity = severity;
    appendTimeline(incident, 'severity', `Severity changed from ${prior} to ${severity}: ${clean(reason, 300)}`, at);
    activity(state, `${incident.reference} severity changed to ${severity}.`, at); return incident;
  }
  function addUpdate(state, id, input, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (['Resolved', 'Closed'].includes(incident.status)) throw new Error('Customer updates are locked after resolution.');
    const message = clean(input && input.message, 30);
    if (message.length < 30) throw new Error('Update must contain at least 30 characters.');
    const audience = clean(input.audience || 'Customer-facing', 40);
    if (!['Customer-facing', 'Internal operations', 'Leadership'].includes(audience)) throw new Error('Choose a valid update audience.');
    const update = { id: makeId('upd'), at: isoNow(at), audience, message, eta: clean(input.eta || 'Not confirmed', 80), channels: Array.isArray(input.channels) ? input.channels.filter((x) => CHANNELS.includes(x)) : [] };
    incident.updates.unshift(update); appendTimeline(incident, 'update', `${audience} update recorded.`, update.at);
    activity(state, `${incident.reference} update recorded for ${audience.toLowerCase()}.`, update.at); return update;
  }
  function addTask(state, id, input, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (incident.status === 'Closed') throw new Error('Follow-up tasks are locked after incident closure.');
    const title = clean(input && input.title, 160); const owner = clean(input && input.owner, 100);
    if (title.length < 5 || owner.length < 2) throw new Error('Enter a task and a named owner.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate || '')) || !validDate(`${input.dueDate}T00:00:00Z`)) throw new Error('Enter a valid task due date.');
    const task = { id: makeId('task'), title, owner, dueDate: input.dueDate, status: 'Open', createdAt: isoNow(at), completedAt: null };
    incident.tasks.unshift(task); appendTimeline(incident, 'task', `Follow-up task created: ${title} (${owner}; due ${task.dueDate}).`, at);
    activity(state, `${incident.reference} follow-up task created.`, at); return task;
  }
  function completeTask(state, id, taskId, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    const task = incident.tasks.find((item) => item.id === taskId); if (!task) throw new Error('Follow-up task not found.');
    if (incident.status === 'Closed') throw new Error('Follow-up tasks are locked after incident closure.');
    if (task.status === 'Complete') throw new Error('Task is already complete.');
    task.status = 'Complete'; task.completedAt = isoNow(at);
    appendTimeline(incident, 'task', `Follow-up task completed: ${task.title}.`, at); activity(state, `${incident.reference} task completed.`, at); return task;
  }
  function savePostmortem(state, id, input, at) {
    const incident = getIncident(state, id); if (!incident) throw new Error('Incident not found.');
    if (incident.status !== 'Resolved') throw new Error('A post-incident review can only be finalised while the incident is resolved and not yet closed.');
    const fields = {
      impactSummary: clean(input && input.impactSummary, 1000), rootCause: clean(input && input.rootCause, 1000),
      contributingFactors: clean(input && input.contributingFactors, 1000), whatWentWell: clean(input && input.whatWentWell, 1000),
      improvements: clean(input && input.improvements, 1000), reviewer: clean(input && input.reviewer, 100)
    };
    if (fields.impactSummary.length < 20 || fields.rootCause.length < 20 || fields.improvements.length < 20 || fields.reviewer.length < 2) throw new Error('Complete impact, root cause, improvement actions and reviewer before finalising the review.');
    const actions = Array.isArray(input.actions) ? input.actions.map((item) => ({ title: clean(item.title, 160), owner: clean(item.owner, 100), dueDate: String(item.dueDate || ''), status: 'Open' })).filter((item) => item.title.length >= 5 && item.owner.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) : [];
    if (!actions.length) throw new Error('Add at least one owned, dated follow-up action.');
    incident.postmortem = { ...fields, actions, completedAt: isoNow(at) };
    appendTimeline(incident, 'postmortem', `Post-incident review completed by ${fields.reviewer}.`, at);
    activity(state, `${incident.reference} post-incident review completed.`, at); return incident.postmortem;
  }
  function createMaintenance(state, input, at) {
    const title = clean(input && input.title, 140), productId = input && input.productId;
    if (title.length < 5 || !PRODUCTS.some((p) => p.id === productId)) throw new Error('Enter a maintenance title and valid service.');
    const start = new Date(input.startAt), end = new Date(input.endAt);
    if (!validDate(start) || !validDate(end) || end <= start) throw new Error('Maintenance end must be later than its start.');
    if (clean(input.owner, 2).length < 2) throw new Error('Assign a maintenance owner.');
    const item = { id: makeId('maint'), title, productId, owner: clean(input.owner, 100), startAt: start.toISOString(), endAt: end.toISOString(), status: 'Planned', customerImpact: clean(input.customerImpact, 500), createdAt: isoNow(at) };
    state.maintenance.unshift(item); activity(state, `Planned maintenance scheduled: ${title}.`, at); return item;
  }
  function setMaintenanceStatus(state, id, status, at) {
    const item = state.maintenance.find((entry) => entry.id === id); if (!item) throw new Error('Maintenance record not found.');
    if (!['Planned', 'In progress', 'Completed', 'Cancelled'].includes(status)) throw new Error('Invalid maintenance status.');
    item.status = status; item.updatedAt = isoNow(at); activity(state, `Maintenance ${item.title} marked ${status.toLowerCase()}.`, at); return item;
  }
  function getSla(incident, now = new Date()) {
    const target = SLA[incident.severity] || SLA['SEV 4 - Low'];
    const detected = new Date(incident.detectedAt).getTime(); const current = new Date(now).getTime();
    const ackDeadline = detected + target.acknowledgeMinutes * 60000;
    let ack = 'Pending';
    if (incident.acknowledgedAt) ack = new Date(incident.acknowledgedAt).getTime() <= ackDeadline ? 'Met' : 'Missed';
    else if (current > ackDeadline && !['Resolved', 'Closed'].includes(incident.status)) ack = 'Overdue';
    const lastPublicUpdate = incident.updates.find((item) => item.audience === 'Customer-facing');
    const updateBase = lastPublicUpdate ? new Date(lastPublicUpdate.at).getTime() : incident.acknowledgedAt ? new Date(incident.acknowledgedAt).getTime() : detected;
    const updateDeadline = updateBase + target.updateMinutes * 60000;
    let update = 'Due';
    if (['Resolved', 'Closed'].includes(incident.status)) update = 'Stopped';
    else if (lastPublicUpdate && current <= updateDeadline) update = 'On track';
    else if (current > updateDeadline) update = 'Overdue';
    return { acknowledgeMinutes: target.acknowledgeMinutes, updateMinutes: target.updateMinutes, ack, update, ackDeadline: new Date(ackDeadline).toISOString(), nextUpdateDueAt: new Date(updateDeadline).toISOString(), ageMinutes: Math.max(0, Math.floor((current - detected) / 60000)) };
  }
  function getMetrics(state, now = new Date()) {
    const active = state.incidents.filter((item) => !['Resolved', 'Closed'].includes(item.status));
    const slas = active.map((item) => getSla(item, now));
    return {
      active: active.length,
      critical: active.filter((item) => item.severity === SEVERITIES[0]).length,
      high: active.filter((item) => item.severity === SEVERITIES[1]).length,
      overdueAcknowledgements: slas.filter((item) => item.ack === 'Overdue').length,
      overdueUpdates: slas.filter((item) => item.update === 'Overdue').length,
      awaitingReview: state.incidents.filter((item) => item.status === 'Resolved' && !item.postmortem).length,
      plannedMaintenance: state.maintenance.filter((item) => item.status === 'Planned').length
    };
  }
  function listKnowledgeNotices(target) {
    if (!target || typeof target.getItem !== 'function') return [];
    try {
      const raw = JSON.parse(target.getItem(KNOWLEDGE_KEY) || 'null');
      if (!raw || !Array.isArray(raw.notices)) return [];
      return raw.notices.filter((item) => item && item.status === 'Published').map((item) => ({
        id: clean(item.id, 100), title: clean(item.title, 140), productId: PRODUCTS.some((p) => p.id === item.productId) ? item.productId : 'general',
        severity: clean(item.severity, 30), audience: clean(item.audience, 100), summary: clean(item.summary, 700),
        effectiveAt: clean(item.effectiveAt, 20), publishedAt: clean(item.publishedAt, 30)
      }));
    } catch (_) { return []; }
  }
  function pushKnowledgeNotice(state, incidentId, target, at) {
    const incident = getIncident(state, incidentId); if (!incident) throw new Error('Incident not found.');
    if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') throw new Error('Browser storage is unavailable.');
    if (!['Mitigating', 'Monitoring', 'Resolved'].includes(incident.status)) throw new Error('Move the incident to Mitigating before drafting a knowledge notice.');
    const summary = clean(incident.customerSummary || incident.impact, 700);
    if (summary.length < 20) throw new Error('Add a customer-facing impact summary before creating a notice.');
    let knowledge;
    try { knowledge = JSON.parse(target.getItem(KNOWLEDGE_KEY) || 'null'); } catch (_) { throw new Error('Knowledge Operations data could not be read.'); }
    if (!knowledge || !Array.isArray(knowledge.notices)) throw new Error('Knowledge Operations v5.2 records were not found in this browser. Open and save the Knowledge Operations page first.');
    const existing = knowledge.notices.find((notice) => notice && notice.sourceIncidentId === incident.id);
    if (existing) { incident.sourceKnowledgeNoticeId = existing.id; return { notice: existing, created: false }; }
    const severity = incident.severity.startsWith('SEV 1') ? 'Critical' : incident.severity.startsWith('SEV 2') ? 'Important' : 'Information';
    const now = isoNow(at); const notice = {
      id: makeId('notice-inc'), title: `${incident.reference}: ${incident.title}`, productId: incident.productId,
      severity, audience: 'All customer-care teams', summary, effectiveAt: now.slice(0, 10), status: 'Draft',
      createdAt: now.slice(0, 10), publishedAt: null, sourceBriefingId: null, sourceIncidentId: incident.id,
      incidentReference: incident.reference, incidentStatus: incident.status
    };
    knowledge.notices.unshift(notice);
    if (Array.isArray(knowledge.activity)) knowledge.activity.unshift({ id: makeId('ko-act'), date: now.slice(0, 10), text: `Incident notice draft received from Service Reliability Control: ${incident.reference}.` });
    target.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge));
    incident.sourceKnowledgeNoticeId = notice.id;
    state.integration.lastNoticePushAt = now; state.integration.noticePushes += 1;
    activity(state, `Knowledge notice draft created for ${incident.reference}.`, now);
    return { notice, created: true };
  }
  function exportIncidentsCSV(state, now = new Date()) {
    const rows = [['reference','title','product','severity','status','owner','detectedAt','acknowledgedAt','resolvedAt','estimatedCustomers','channels','ackSla','updateSla']];
    state.incidents.forEach((incident) => { const sla = getSla(incident, now); rows.push([incident.reference,incident.title,productName(incident.productId),incident.severity,incident.status,incident.owner,incident.detectedAt,incident.acknowledgedAt || '',incident.resolvedAt || '',incident.estimatedCustomers,(incident.channels || []).join('; '),sla.ack,sla.update]); });
    return rows.map((row) => row.map((cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, KNOWLEDGE_KEY, PRODUCTS, SEVERITIES, STATUSES, CHANNELS, SLA, TRANSITIONS, DEMO_SCENARIOS,
    createInitialState, normaliseState, load, save, clean, productName, getIncident, validateIncident, createIncident, launchScenario,
    acknowledgeIncident, assignOwner, transitionIncident, changeSeverity, addUpdate, addTask, completeTask, savePostmortem,
    createMaintenance, setMaintenanceStatus, getSla, getMetrics, listKnowledgeNotices, pushKnowledgeNotice, exportIncidentsCSV
  };
});
