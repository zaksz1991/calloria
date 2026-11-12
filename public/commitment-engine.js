(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaCommitmentEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.9.0';
  const STORAGE_KEY = 'calloria.customer-commitments.v69';
  const PLANS = Object.freeze({
    '30-min': { label: 'Callback in 30 simulated minutes', kind: 'same-shift', minutes: 30 },
    '60-min': { label: 'Callback in 60 simulated minutes', kind: 'same-shift', minutes: 60 },
    'next-day': { label: 'Next working day · 09:00', kind: 'next-day', days: 1, minute: 540 },
    'two-days': { label: 'Two working days · 10:00', kind: 'next-day', days: 2, minute: 600 }
  });
  const OUTCOMES = Object.freeze(['completed', 'no-answer', 'further-action']);
  const MAX_ATTEMPTS = 2;

  function clean(value, max = 500) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function validDateText(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()); }
  function dateFromText(value, minutes = 0) {
    if (!validDateText(value)) throw new Error('A valid simulated shift date is required.');
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
  }
  function dateText(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid simulated date.');
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addWorkingDays(dateString, count) {
    if (!validDateText(dateString)) throw new Error('A valid simulated shift date is required.');
    const d = dateFromText(dateString, 0);
    let remaining = Math.max(1, Math.floor(Number(count) || 1));
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) remaining -= 1;
    }
    return dateText(d);
  }
  function makeDue(shift, planId) {
    if (!shift || !validDateText(shift.date)) throw new Error('Start a shift before scheduling a customer commitment.');
    const plan = PLANS[planId];
    if (!plan) throw new Error('Choose a valid callback commitment time.');
    let dueDate = shift.date;
    let dueMinutes;
    if (plan.kind === 'same-shift') {
      dueMinutes = Math.max(0, Number(shift.minutes) || 0) + plan.minutes;
      if (dueMinutes > 16 * 60) {
        dueDate = addWorkingDays(dueDate, 1);
        dueMinutes = 9 * 60;
      }
    } else {
      dueDate = addWorkingDays(dueDate, plan.days);
      dueMinutes = plan.minute;
    }
    return { dueDate, dueMinutes, planId, planLabel: plan.label };
  }
  function validateCreation(input, shift) {
    if (!input || !clean(input.customerId, 100)) throw new Error('A customer profile is required for a callback commitment.');
    if (!clean(input.customerName, 120)) throw new Error('The customer name is required.');
    if (!clean(input.contactReference, 80)) throw new Error('The originating contact reference is required.');
    if (!clean(input.owner, 100)) throw new Error('A named callback owner is required.');
    const commitment = clean(input.commitment, 180);
    if (commitment.length < 10) throw new Error('Describe what the customer is waiting for in at least 10 characters.');
    return { ...makeDue(shift, input.planId), customerId: clean(input.customerId, 100), customerName: clean(input.customerName, 120), contactReference: clean(input.contactReference, 80), caseId: clean(input.caseId, 100), subject: clean(input.subject, 180), productId: clean(input.productId, 80), preferredChannel: clean(input.preferredChannel || 'Voice', 40), owner: clean(input.owner, 100), team: clean(input.team || 'Customer Care', 100), commitment };
  }
  function createState() { return { version: VERSION, commitments: [], activity: [] }; }
  function normaliseState(raw) {
    const base = createState();
    if (!raw || typeof raw !== 'object') return base;
    const commitments = Array.isArray(raw.commitments) ? raw.commitments.filter((item) => item && item.id && item.customerId && item.owner && PLANS[item.planId] && validDateText(item.dueDate) && Number.isFinite(Number(item.dueMinutes))).map((item) => ({
      id: clean(item.id, 100), customerId: clean(item.customerId, 100), customerName: clean(item.customerName, 120), contactReference: clean(item.contactReference, 80), caseId: clean(item.caseId, 100), subject: clean(item.subject, 180), productId: clean(item.productId, 80), preferredChannel: clean(item.preferredChannel || 'Voice', 40), owner: clean(item.owner, 100), team: clean(item.team || 'Customer Care', 100), commitment: clean(item.commitment, 180), planId: item.planId, planLabel: clean(item.planLabel || PLANS[item.planId].label, 100), dueDate: item.dueDate, dueMinutes: Math.max(0, Math.min(1439, Math.floor(Number(item.dueMinutes)))), attempts: Math.max(0, Math.min(20, Math.floor(Number(item.attempts) || 0))), status: ['Open', 'Complete', 'Needs review'].includes(item.status) ? item.status : 'Open', createdAt: item.createdAt || null, completedAt: item.completedAt || null, reviewedBy: clean(item.reviewedBy, 100), lastOutcome: clean(item.lastOutcome, 40), lastSummary: clean(item.lastSummary, 500), history: Array.isArray(item.history) ? item.history.slice(0, 20) : []
    })) : [];
    return { version: VERSION, commitments: commitments.slice(0, 500), activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 200) : [] };
  }
  function load(storage) {
    try { return normaliseState(JSON.parse(storage && storage.getItem(STORAGE_KEY) || 'null')); }
    catch (_) { return createState(); }
  }
  function save(state, storage) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(normaliseState(state))); return true; }
    catch (_) { return false; }
  }
  function log(state, message, at) {
    state.activity = Array.isArray(state.activity) ? state.activity : [];
    state.activity.unshift({ at: (at instanceof Date ? at : new Date(at || Date.now())).toISOString(), message: clean(message, 260) });
    state.activity = state.activity.slice(0, 200);
  }
  function createCommitment(state, input, shift, at) {
    const fields = validateCreation(input, shift);
    state.commitments = Array.isArray(state.commitments) ? state.commitments : [];
    const now = at instanceof Date ? at : new Date(at || Date.now());
    const item = { id: `CB-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, ...fields, attempts: 0, status: 'Open', createdAt: now.toISOString(), completedAt: null, lastOutcome: '', lastSummary: '', history: [] };
    state.commitments.unshift(item);
    state.commitments = state.commitments.slice(0, 500);
    log(state, `Callback commitment created for ${item.customerName}, due ${item.dueDate} ${formatClock(item.dueMinutes)}.`, now);
    return item;
  }
  function getCommitment(state, id) { return (state && Array.isArray(state.commitments) ? state.commitments : []).find((item) => item.id === id) || null; }
  function formatClock(minutes) {
    const n = Math.max(0, Math.min(1439, Math.floor(Number(minutes) || 0)));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function gameInstant(date, minutes) { return dateFromText(date, minutes).getTime(); }
  function classify(item, shift) {
    if (item.status === 'Complete') return { state: 'Completed', deltaMinutes: null };
    if (item.status === 'Needs review') return { state: 'Needs review', deltaMinutes: null };
    if (!shift || !validDateText(shift.date)) return { state: 'Scheduled', deltaMinutes: null };
    const due = gameInstant(item.dueDate, item.dueMinutes);
    const current = gameInstant(shift.date, shift.minutes);
    const deltaMinutes = Math.round((due - current) / 60000);
    if (deltaMinutes < -30) return { state: 'Overdue', deltaMinutes };
    if (deltaMinutes <= 0) return { state: 'Due', deltaMinutes };
    if (deltaMinutes <= 15) return { state: 'Due soon', deltaMinutes };
    return { state: 'Scheduled', deltaMinutes };
  }
  function listForAgent(state, identity, shift) {
    const name = clean(identity && identity.name, 100).toLowerCase();
    if (!name) return [];
    return (state && Array.isArray(state.commitments) ? state.commitments : [])
      .filter((item) => item.owner.toLowerCase() === name && item.status !== 'Complete')
      .map((item) => ({ ...item, timing: classify(item, shift) }))
      .sort((a, b) => {
        const rank = { 'Overdue': 0, 'Needs review': 1, 'Due': 2, 'Due soon': 3, 'Scheduled': 4 };
        return (rank[a.timing.state] ?? 5) - (rank[b.timing.state] ?? 5) || a.dueDate.localeCompare(b.dueDate) || a.dueMinutes - b.dueMinutes;
      });
  }
  function rescheduleToNextWorkingDay(item, shift, minutes = 600) {
    const baseDate = shift && validDateText(shift.date) && shift.date > item.dueDate ? shift.date : item.dueDate;
    item.dueDate = addWorkingDays(baseDate, 1);
    item.dueMinutes = minutes;
  }
  function recordOutcome(state, commitmentId, input, shift, at) {
    const item = getCommitment(state, commitmentId);
    if (!item) throw new Error('Customer commitment was not found.');
    if (item.status === 'Complete') throw new Error('This customer commitment is already complete.');
    if (item.status === 'Needs review') throw new Error('A supervisor must review this commitment before another callback attempt.');
    const outcome = input && input.outcome;
    if (!OUTCOMES.includes(outcome)) throw new Error('Choose a valid callback outcome.');
    const summary = clean(input && input.summary, 500);
    if (summary.length < 20) throw new Error('Record at least 20 characters describing the callback outcome.');
    const now = at instanceof Date ? at : new Date(at || Date.now());
    item.attempts += 1;
    item.lastOutcome = outcome;
    item.lastSummary = summary;
    item.history = Array.isArray(item.history) ? item.history : [];
    item.history.unshift({ at: now.toISOString(), outcome, summary, attempt: item.attempts });
    item.history = item.history.slice(0, 20);
    if (outcome === 'completed') {
      item.status = 'Complete';
      item.completedAt = now.toISOString();
      log(state, `Customer commitment ${item.id} completed after ${item.attempts} attempt(s).`, now);
    } else if (item.attempts >= MAX_ATTEMPTS) {
      item.status = 'Needs review';
      log(state, `Customer commitment ${item.id} requires supervisor review after ${item.attempts} attempts.`, now);
    } else {
      item.status = 'Open';
      rescheduleToNextWorkingDay(item, shift, 600);
      log(state, `Customer commitment ${item.id} rescheduled after ${outcome === 'no-answer' ? 'no answer' : 'further action'}.`, now);
    }
    return { item, state: classify(item, shift), requiresReview: item.status === 'Needs review' };
  }
  function closeAfterReview(state, commitmentId, reviewer, summary, at, agentName) {
    const item = getCommitment(state, commitmentId);
    if (!item || item.status !== 'Needs review') throw new Error('Only commitments requiring review can be closed here.');
    const reviewerName = clean(reviewer, 100);
    if (reviewerName.length < 2) throw new Error('Enter the reviewing manager or supervisor name.');
    if (agentName && reviewerName.toLowerCase() === clean(agentName, 100).toLowerCase()) throw new Error('The reviewing manager must be different from the callback owner.');
    const note = clean(summary, 500);
    if (note.length < 20) throw new Error('Enter at least 20 characters explaining the supervisor review outcome.');
    const now = at instanceof Date ? at : new Date(at || Date.now());
    item.status = 'Complete'; item.completedAt = now.toISOString(); item.lastOutcome = 'supervisor-review'; item.lastSummary = note; item.reviewedBy = reviewerName;
    item.history.unshift({ at: now.toISOString(), outcome: 'supervisor-review', reviewer: reviewerName, summary: note, attempt: item.attempts });
    item.history = item.history.slice(0, 20);
    log(state, `Customer commitment ${item.id} closed after supervisor review by ${reviewerName}.`, now);
    return item;
  }

  return { VERSION, STORAGE_KEY, PLANS, OUTCOMES, MAX_ATTEMPTS, clean, validDateText, dateText, addWorkingDays, makeDue, validateCreation, createState, normaliseState, load, save, log, createCommitment, getCommitment, formatClock, classify, listForAgent, recordOutcome, closeAfterReview };
});
