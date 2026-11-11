(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaVoiceOfCustomerEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.6.0';
  const STORAGE_KEY = 'calloria.voice-of-customer.v56';
  const WORKBENCH_KEY = 'calloria.agent-workbench.v55';
  const CUSTOMER_KEY = 'calloria.customer-journey.v54';
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app'];
  const THEMES = ['Resolution quality', 'Response speed', 'Staff courtesy', 'Product usability', 'Communication', 'Repeat contact', 'Accessibility', 'Other'];
  const RECOVERY_STATUSES = ['Open', 'Assigned', 'In progress', 'Resolved', 'Closed'];
  const PRODUCTS = [
    { id: 'general', name: 'General customer service' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
    { id: 'kano-run', name: 'Kano Run' },
    { id: 'kano-keke', name: 'Kano Keke' }
  ];

  function clean(value, max = 800) {
    return String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function iso(value) {
    const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');
    return date.toISOString();
  }
  function addHours(value, hours) { return new Date(new Date(value).getTime() + hours * 3600000).toISOString(); }
  function productName(id) { return (PRODUCTS.find((item) => item.id === id) || PRODUCTS[0]).name; }
  function intInRange(value, min, max, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
    return number;
  }
  function npsGroup(score) { return score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor'; }
  function isRecoveryRequired(item) { return item.csat <= 2 || item.nps <= 6 || item.ces <= 2; }

  function demoFeedback(now) {
    const base = new Date(now).getTime();
    const rows = [
      { id: 'VOC-56001', customerId: 'CUS-1001', contactRef: 'CT-55001', caseId: 'CASE-54001', channel: 'Live chat', productId: 'ruffneck-lms', csat: 2, nps: 4, ces: 2, theme: 'Resolution quality', comment: 'The course is still missing and I had to explain the problem again.', capturedHoursAgo: 2 },
      { id: 'VOC-56002', customerId: 'CUS-1002', contactRef: 'CT-55002', caseId: 'CASE-54002', channel: 'Voice', productId: 'kano-run', csat: 4, nps: 9, ces: 4, theme: 'Staff courtesy', comment: 'The agent was patient and explained the safe account checks clearly.', capturedHoursAgo: 5 },
      { id: 'VOC-56003', customerId: 'CUS-1003', contactRef: 'CT-55003', caseId: 'CASE-54003', channel: 'Email', productId: 'ruffneck-social-hub', csat: 5, nps: 10, ces: 5, theme: 'Communication', comment: 'The instructions were clear and easy to follow.', capturedHoursAgo: 20 },
      { id: 'VOC-56004', customerId: 'CUS-1004', contactRef: 'CT-55004', caseId: 'CASE-54004', channel: 'Social', productId: 'ruffneck-prospector', csat: 3, nps: 7, ces: 3, theme: 'Response speed', comment: 'The response was useful, but the investigation took longer than expected.', capturedHoursAgo: 28 },
      { id: 'VOC-56005', customerId: 'CUS-1005', contactRef: 'CT-55005', caseId: 'CASE-54005', channel: 'In-app', productId: 'kano-keke', csat: 2, nps: 5, ces: 1, theme: 'Product usability', comment: 'The stage instructions were confusing and I could not find the next objective.', capturedHoursAgo: 50 },
      { id: 'VOC-56006', customerId: 'CUS-1006', contactRef: 'CT-55006', caseId: null, channel: 'Email', productId: 'kano-run', csat: 5, nps: 9, ces: 5, theme: 'Staff courtesy', comment: 'The team gave a professional explanation of the proposal process.', capturedHoursAgo: 76 }
    ];
    return rows.map((row) => {
      const capturedAt = new Date(base - row.capturedHoursAgo * 3600000).toISOString();
      const { capturedHoursAgo, ...rest } = row;
      return { ...rest, reference: rest.id, capturedAt, source: 'Demonstration sample', demo: true, promoterGroup: npsGroup(rest.nps) };
    });
  }
  function createInitialState(now) {
    const current = iso(now);
    const feedback = demoFeedback(current);
    const recoveryTasks = feedback.filter(isRecoveryRequired).map((item, index) => ({
      id: `REC-56${String(index + 1).padStart(3, '0')}`, feedbackId: item.id, customerId: item.customerId,
      contactRef: item.contactRef, caseId: item.caseId, reason: recoveryReason(item), owner: 'Customer Care Supervisor',
      status: 'Open', priority: item.csat === 1 || item.nps <= 3 ? 'Urgent' : 'High',
      createdAt: item.capturedAt, dueAt: addHours(item.capturedAt, 24), updatedAt: item.capturedAt,
      resolution: '', updates: [], demo: true
    }));
    return {
      version: VERSION, feedback, invitations: [], recoveryTasks,
      activity: [{ id: makeId('act'), at: current, message: 'Voice of Customer demonstration workspace loaded.' }],
      integration: { workbenchKey: WORKBENCH_KEY, customerKey: CUSTOMER_KEY, lastWorkbenchImportAt: null, lastCaseSyncAt: null }
    };
  }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      feedback: Array.isArray(raw.feedback) ? raw.feedback : fresh.feedback,
      invitations: Array.isArray(raw.invitations) ? raw.invitations : [],
      recoveryTasks: Array.isArray(raw.recoveryTasks) ? raw.recoveryTasks : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
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
  function log(state, message, at) {
    state.activity.unshift({ id: makeId('act'), at: iso(at), message: clean(message, 240) });
    state.activity = state.activity.slice(0, 200);
  }
  function recoveryReason(item) {
    const reasons = [];
    if (item.csat <= 2) reasons.push(`low satisfaction (${item.csat}/5)`);
    if (item.nps <= 6) reasons.push(`detractor score (${item.nps}/10)`);
    if (item.ces <= 2) reasons.push(`high customer effort (${item.ces}/5)`);
    return reasons.join('; ') || 'Customer feedback requires review';
  }
  function validateFeedback(input) {
    if (!input || typeof input !== 'object') throw new Error('Feedback details are required.');
    const customerId = clean(input.customerId, 80);
    if (customerId && !/^[A-Za-z0-9_-]{3,80}$/.test(customerId)) throw new Error('Enter a valid customer reference.');
    const channel = input.channel || 'Email';
    if (!CHANNELS.includes(channel)) throw new Error('Choose a valid contact channel.');
    const productId = input.productId || 'general';
    if (!PRODUCTS.some((item) => item.id === productId)) throw new Error('Choose a valid product or service.');
    const theme = input.theme || 'Other';
    if (!THEMES.includes(theme)) throw new Error('Choose a valid feedback theme.');
    const csat = intInRange(input.csat, 1, 5, 'CSAT');
    const nps = intInRange(input.nps, 0, 10, 'NPS');
    const ces = intInRange(input.ces, 1, 5, 'Customer effort');
    const comment = clean(input.comment, 1200);
    if (comment.length < 5) throw new Error('Feedback comment must contain at least five characters.');
    return {
      customerId, contactRef: clean(input.contactRef, 100), caseId: clean(input.caseId, 100) || null,
      channel, productId, csat, nps, ces, theme, comment,
      source: clean(input.source || 'Manually recorded', 80)
    };
  }
  function getFeedback(state, feedbackId) { return state.feedback.find((item) => item.id === feedbackId) || null; }
  function getInvitation(state, invitationId) { return state.invitations.find((item) => item.id === invitationId) || null; }
  function getRecoveryTask(state, taskId) { return state.recoveryTasks.find((item) => item.id === taskId) || null; }

  function importCompletedContacts(state, workbenchRaw, at) {
    const workbench = workbenchRaw && typeof workbenchRaw === 'object' ? workbenchRaw : null;
    const contacts = workbench && Array.isArray(workbench.contacts) ? workbench.contacts : [];
    const now = iso(at);
    const existing = new Set([
      ...state.invitations.map((item) => item.contactId),
      ...state.feedback.map((item) => item.contactId).filter(Boolean),
      ...state.feedback.map((item) => item.contactRef).filter(Boolean)
    ]);
    const imported = [];
    contacts.filter((item) => item && item.status === 'Completed').forEach((contact) => {
      const ref = clean(contact.reference || contact.id, 100);
      if (!ref || existing.has(contact.id) || existing.has(ref)) return;
      const invitation = {
        id: makeId('SUR'), contactId: clean(contact.id, 100), contactRef: ref,
        customerId: clean(contact.customerId, 80), caseId: clean(contact.wrapUp && contact.wrapUp.linkedCaseId || contact.linkedCaseId, 100) || null,
        channel: CHANNELS.includes(contact.channel) ? contact.channel : 'Email',
        productId: PRODUCTS.some((p) => p.id === contact.productId) ? contact.productId : 'general',
        subject: clean(contact.subject || 'Completed support interaction', 180),
        completedAt: contact.completedAt && !Number.isNaN(new Date(contact.completedAt).getTime()) ? new Date(contact.completedAt).toISOString() : now,
        status: 'Ready to record', source: 'v5.5 agent workbench', createdAt: now, capturedFeedbackId: null
      };
      state.invitations.unshift(invitation); imported.push(invitation); existing.add(contact.id); existing.add(ref);
    });
    state.integration.lastWorkbenchImportAt = now;
    log(state, `Imported ${imported.length} completed contact${imported.length === 1 ? '' : 's'} from the v5.5 workbench.`, now);
    return imported;
  }
  function importFromStorage(state, storage, at) {
    if (!storage || typeof storage.getItem !== 'function') throw new Error('Browser storage is unavailable.');
    let raw;
    try { raw = JSON.parse(storage.getItem(WORKBENCH_KEY) || 'null'); }
    catch (_) { throw new Error('The v5.5 workbench data is not valid JSON.'); }
    if (!raw) return importCompletedContacts(state, null, at);
    return importCompletedContacts(state, raw, at);
  }
  function createFeedback(state, input, at) {
    const fields = validateFeedback(input);
    const invitation = input.invitationId ? getInvitation(state, input.invitationId) : null;
    if (input.invitationId && !invitation) throw new Error('Survey invitation was not found.');
    if (invitation && invitation.capturedFeedbackId) throw new Error('Feedback has already been recorded for this contact.');
    if (invitation) {
      fields.customerId = fields.customerId || invitation.customerId;
      fields.contactRef = fields.contactRef || invitation.contactRef;
      fields.caseId = fields.caseId || invitation.caseId;
      fields.channel = invitation.channel;
      fields.productId = invitation.productId;
    }
    const now = iso(at);
    const item = {
      id: makeId('VOC'), reference: `VOC-${new Date(now).getUTCFullYear()}-${Math.random().toString(10).slice(2, 8).padEnd(6, '0')}`,
      ...fields, capturedAt: now, promoterGroup: npsGroup(fields.nps), demo: false,
      contactId: invitation ? invitation.contactId : null, invitationId: invitation ? invitation.id : null
    };
    state.feedback.unshift(item);
    if (invitation) { invitation.status = 'Feedback recorded'; invitation.capturedFeedbackId = item.id; }
    if (isRecoveryRequired(item)) {
      const task = createRecoveryTask(state, item, now);
      item.recoveryTaskId = task.id;
    }
    log(state, `Feedback ${item.reference} recorded for ${item.contactRef || item.customerId || 'an unlinked interaction'}.`, now);
    return item;
  }
  function createRecoveryTask(state, item, at) {
    const existing = state.recoveryTasks.find((task) => task.feedbackId === item.id);
    if (existing) return existing;
    const now = iso(at);
    const task = {
      id: makeId('REC'), feedbackId: item.id, customerId: item.customerId, contactRef: item.contactRef,
      caseId: item.caseId, reason: recoveryReason(item), owner: 'Customer Care Supervisor',
      status: 'Open', priority: item.csat === 1 || item.nps <= 3 ? 'Urgent' : 'High',
      createdAt: now, dueAt: addHours(now, 24), updatedAt: now, resolution: '', updates: [], demo: false
    };
    state.recoveryTasks.unshift(task);
    return task;
  }
  function updateRecoveryTask(state, taskId, patch, at) {
    const task = getRecoveryTask(state, taskId);
    if (!task) throw new Error('Recovery task not found.');
    const nextStatus = patch && patch.status !== undefined ? patch.status : task.status;
    if (!RECOVERY_STATUSES.includes(nextStatus)) throw new Error('Choose a valid recovery status.');
    const owner = patch && patch.owner !== undefined ? clean(patch.owner, 100) : task.owner;
    if (['Assigned', 'In progress', 'Resolved', 'Closed'].includes(nextStatus) && owner.length < 2) throw new Error('Assign an owner before moving this task forward.');
    const resolution = patch && patch.resolution !== undefined ? clean(patch.resolution, 1000) : task.resolution;
    if (['Resolved', 'Closed'].includes(nextStatus) && resolution.length < 10) throw new Error('Enter at least 10 characters of recovery outcome before resolving or closing.');
    const now = iso(at);
    const update = { id: makeId('upd'), at: now, status: nextStatus, owner, note: clean(patch && patch.note, 600), resolution };
    task.owner = owner; task.status = nextStatus; task.resolution = resolution; task.updatedAt = now;
    task.updates = Array.isArray(task.updates) ? task.updates : [];
    task.updates.unshift(update); task.updates = task.updates.slice(0, 80);
    log(state, `Recovery task ${task.id} moved to ${nextStatus}.`, now);
    return task;
  }
  function scoreMetrics(feedback) {
    const rows = Array.isArray(feedback) ? feedback : [];
    const count = rows.length;
    if (!count) return { responses: 0, csatAverage: null, csatSatisfiedPct: null, nps: null, cesAverage: null, promoters: 0, passives: 0, detractors: 0 };
    const csatAverage = rows.reduce((sum, item) => sum + Number(item.csat || 0), 0) / count;
    const cesAverage = rows.reduce((sum, item) => sum + Number(item.ces || 0), 0) / count;
    const promoters = rows.filter((item) => Number(item.nps) >= 9).length;
    const passives = rows.filter((item) => Number(item.nps) >= 7 && Number(item.nps) <= 8).length;
    const detractors = rows.filter((item) => Number(item.nps) <= 6).length;
    const nps = Math.round(((promoters - detractors) / count) * 100);
    const satisfied = rows.filter((item) => Number(item.csat) >= 4).length;
    return { responses: count, csatAverage, csatSatisfiedPct: Math.round((satisfied / count) * 100), nps, cesAverage, promoters, passives, detractors };
  }
  function groupCounts(feedback, field) {
    const result = {};
    (Array.isArray(feedback) ? feedback : []).forEach((item) => {
      const key = clean(item[field] || 'Unknown', 100) || 'Unknown';
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }
  function getDashboard(state, now) {
    const metrics = scoreMetrics(state.feedback);
    const tasks = state.recoveryTasks.filter((item) => !['Resolved', 'Closed'].includes(item.status));
    const overdue = tasks.filter((item) => new Date(item.dueAt).getTime() < new Date(now == null ? Date.now() : now).getTime()).length;
    const themes = groupCounts(state.feedback, 'theme');
    const npsGroups = { Promoters: metrics.promoters, Passives: metrics.passives, Detractors: metrics.detractors };
    const channels = Object.keys(groupCounts(state.feedback, 'channel')).map((key) => {
      const rows = state.feedback.filter((item) => item.channel === key);
      return { name: key, count: rows.length, csatAverage: rows.reduce((sum, item) => sum + Number(item.csat), 0) / rows.length };
    }).sort((a, b) => b.count - a.count);
    return { ...metrics, openRecovery: tasks.length, overdueRecovery: overdue, readyInvitations: state.invitations.filter((item) => item.status === 'Ready to record').length, themes, npsGroups, channels };
  }
  function readWorkbench(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try { return JSON.parse(storage.getItem(WORKBENCH_KEY) || 'null'); } catch (_) { return null; }
  }
  function readCustomerJourney(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try { return JSON.parse(storage.getItem(CUSTOMER_KEY) || 'null'); } catch (_) { return null; }
  }
  function syncCaseSatisfaction(state, feedbackId, storage, at) {
    const item = getFeedback(state, feedbackId);
    if (!item) throw new Error('Feedback record was not found.');
    if (!item.caseId) throw new Error('This feedback record is not linked to a customer case.');
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error('Browser storage is unavailable.');
    let journey;
    try { journey = JSON.parse(storage.getItem(CUSTOMER_KEY) || 'null'); } catch (_) { throw new Error('Customer 360 data is not valid JSON.'); }
    if (!journey || !Array.isArray(journey.cases)) throw new Error('Customer 360 v5.4 data was not found in this browser.');
    const customerCase = journey.cases.find((record) => record.id === item.caseId || record.reference === item.caseId);
    if (!customerCase) throw new Error(`Linked case ${item.caseId} was not found in Customer 360.`);
    const now = iso(at);
    const snapshot = { feedbackId: item.id, reference: item.reference, csat: item.csat, nps: item.nps, ces: item.ces, theme: item.theme, comment: item.comment, capturedAt: item.capturedAt || now, syncedAt: now };
    customerCase.satisfaction = { ...snapshot };
    customerCase.satisfactionHistory = Array.isArray(customerCase.satisfactionHistory) ? customerCase.satisfactionHistory : [];
    if (!customerCase.satisfactionHistory.some((entry) => entry.feedbackId === item.id)) customerCase.satisfactionHistory.unshift(snapshot);
    customerCase.satisfactionHistory = customerCase.satisfactionHistory.slice(0, 50);
    customerCase.timeline = Array.isArray(customerCase.timeline) ? customerCase.timeline : [];
    if (!customerCase.timeline.some((entry) => entry.type === 'customer-feedback' && entry.feedbackId === item.id)) {
      customerCase.timeline.unshift({ id: makeId('evt'), at: now, type: 'customer-feedback', feedbackId: item.id, text: `Customer feedback attached: CSAT ${item.csat}/5, NPS ${item.nps}/10, effort ${item.ces}/5.` });
    }
    try { storage.setItem(CUSTOMER_KEY, JSON.stringify(journey)); }
    catch (_) { throw new Error('Could not save feedback to Customer 360. No sync confirmation was recorded.'); }
    state.integration.lastCaseSyncAt = now;
    log(state, `Feedback ${item.reference} attached to Customer 360 case ${item.caseId}.`, now);
    return customerCase;
  }
  function csvEscape(value) {
    let text = String(value == null ? '' : value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function exportFeedbackCsv(state) {
    const rows = [['Feedback reference', 'Captured at', 'Customer ID', 'Contact reference', 'Case reference', 'Channel', 'Product', 'CSAT / 5', 'NPS / 10', 'NPS group', 'Customer effort / 5 (5 = very easy)', 'Theme', 'Comment', 'Source', 'Demonstration sample']];
    state.feedback.forEach((item) => rows.push([item.reference || item.id, item.capturedAt, item.customerId, item.contactRef, item.caseId, item.channel, productName(item.productId), item.csat, item.nps, item.promoterGroup || npsGroup(item.nps), item.ces, item.theme, item.comment, item.source, item.demo ? 'Yes' : 'No']));
    return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  }
  function exportRecoveryCsv(state) {
    const rows = [['Task ID', 'Feedback reference', 'Customer ID', 'Contact reference', 'Case reference', 'Reason', 'Priority', 'Owner', 'Status', 'Created at', 'Due at', 'Resolution']];
    state.recoveryTasks.forEach((task) => {
      const item = getFeedback(state, task.feedbackId);
      rows.push([task.id, item && (item.reference || item.id), task.customerId, task.contactRef, task.caseId, task.reason, task.priority, task.owner, task.status, task.createdAt, task.dueAt, task.resolution]);
    });
    return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, WORKBENCH_KEY, CUSTOMER_KEY, CHANNELS, THEMES, RECOVERY_STATUSES, PRODUCTS,
    clean, iso, addHours, npsGroup, isRecoveryRequired, recoveryReason, createInitialState, normaliseState,
    load, save, getFeedback, getInvitation, getRecoveryTask, validateFeedback, importCompletedContacts,
    importFromStorage, createFeedback, createRecoveryTask, updateRecoveryTask, scoreMetrics, groupCounts,
    getDashboard, readWorkbench, readCustomerJourney, syncCaseSatisfaction, exportFeedbackCsv, exportRecoveryCsv
  };
});
