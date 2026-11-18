/**
 * CALLORIA v6.71 — Case Reopen & Follow-up Lifecycle
 * Local synthetic case records only. No external CRM or customer system is called.
 */

export const CASE_LIFECYCLE_VERSION = '6.71.0';
export const CASE_REOPEN_CATEGORIES = Object.freeze([
  'customer-says-unresolved',
  'incorrect-resolution',
  'new-information',
  'repeat-contact',
  'service-failure'
]);
export const CASE_FOLLOWUP_PRIORITIES = Object.freeze(['urgent', 'normal']);
export const CASE_FOLLOWUP_OUTCOMES = Object.freeze(['resolved', 'pending_customer', 'escalated']);
export const CASE_FOLLOWUP_DECISIONS = Object.freeze(['return_to_agent', 'close_after_review']);
export const MAX_CASE_REOPENS = 5;
const MAX_HISTORY = 30;
const ACTIVE_FOLLOWUP_STATES = new Set(['open', 'in_progress', 'supervisor_review']);
const REOPENABLE_STATUSES = new Set([
  'Resolved',
  'Completed',
  'Callback promise fulfilled',
  'Callback closed after supervisor review',
  'Resolved after reopened follow-up',
  'Resolved after supervisor verification'
]);

function clean(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeNow(value) {
  const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid lifecycle timestamp is required.');
  return date;
}

function normalizeClock(clock = {}) {
  const day = Math.floor(Number(clock.day));
  const minutes = Math.floor(Number(clock.minutes));
  if (!Number.isFinite(day) || day < 1) throw new TypeError('A valid simulated workday is required.');
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1439) throw new TypeError('A valid simulated shift time is required.');
  return { day, minutes, active: clock.active === true };
}

function absoluteMinute(clock) {
  return (clock.day - 1) * 1440 + clock.minutes;
}

function fromAbsoluteMinute(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  return { day: Math.floor(total / 1440) + 1, minutes: total % 1440 };
}

export function formatCaseClock(minutes) {
  const safe = Math.max(0, Math.min(1439, Math.floor(Number(minutes) || 0)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function appendHistory(followUp, event) {
  followUp.history = Array.isArray(followUp.history) ? followUp.history : [];
  followUp.history.unshift(event);
  followUp.history = followUp.history.slice(0, MAX_HISTORY);
}

export function normalizeCaseLifecycle(caseRecord) {
  if (!caseRecord || typeof caseRecord !== 'object' || Array.isArray(caseRecord)) {
    throw new TypeError('A case record is required.');
  }
  const lifecycle = caseRecord.lifecycle && typeof caseRecord.lifecycle === 'object' && !Array.isArray(caseRecord.lifecycle)
    ? caseRecord.lifecycle
    : {};
  lifecycle.version = CASE_LIFECYCLE_VERSION;
  lifecycle.reopenCount = Math.max(0, Math.min(MAX_CASE_REOPENS, Math.floor(Number(lifecycle.reopenCount) || 0)));
  lifecycle.history = Array.isArray(lifecycle.history) ? lifecycle.history.slice(0, MAX_HISTORY) : [];
  if (lifecycle.followUp && typeof lifecycle.followUp === 'object' && !Array.isArray(lifecycle.followUp)) {
    const followUp = lifecycle.followUp;
    followUp.id = clean(followUp.id, 120);
    followUp.status = ['open', 'in_progress', 'supervisor_review', 'complete'].includes(followUp.status) ? followUp.status : 'open';
    followUp.priority = CASE_FOLLOWUP_PRIORITIES.includes(followUp.priority) ? followUp.priority : 'normal';
    followUp.dueDay = Math.max(1, Math.floor(Number(followUp.dueDay) || 1));
    followUp.dueMinute = Math.max(0, Math.min(1439, Math.floor(Number(followUp.dueMinute) || 0)));
    followUp.owner = clean(followUp.owner, 100);
    followUp.openedBy = clean(followUp.openedBy, 100);
    followUp.reasonCategory = CASE_REOPEN_CATEGORIES.includes(followUp.reasonCategory) ? followUp.reasonCategory : 'customer-says-unresolved';
    followUp.reason = clean(followUp.reason, 500);
    followUp.attempts = Math.max(0, Math.min(50, Math.floor(Number(followUp.attempts) || 0)));
    followUp.claimedBy = clean(followUp.claimedBy, 100);
    followUp.history = Array.isArray(followUp.history) ? followUp.history.slice(0, MAX_HISTORY) : [];
  } else {
    lifecycle.followUp = null;
  }
  caseRecord.lifecycle = lifecycle;
  return caseRecord;
}

export function caseReopenEligibility(caseRecord) {
  if (!caseRecord || typeof caseRecord !== 'object') return { eligible: false, reason: 'Case record is unavailable.' };
  const record = normalizeCaseLifecycle(caseRecord);
  const followUp = record.lifecycle.followUp;
  if (followUp && ACTIVE_FOLLOWUP_STATES.has(followUp.status)) {
    return { eligible: false, reason: 'This case already has an active follow-up.' };
  }
  if (!REOPENABLE_STATUSES.has(String(record.status || ''))) {
    return { eligible: false, reason: 'Only a previously resolved or completed case can be reopened.' };
  }
  if (record.lifecycle.reopenCount >= MAX_CASE_REOPENS) {
    return { eligible: false, reason: 'The reopen limit has been reached; independent management review is required.' };
  }
  return { eligible: true, reason: '' };
}

export function reopenCase(caseRecord, input = {}, clockInput = {}, options = {}) {
  const record = normalizeCaseLifecycle(caseRecord);
  const eligibility = caseReopenEligibility(record);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  const clock = normalizeClock(clockInput);
  if (!clock.active) throw new Error('Start an active shift before reopening a case into the follow-up queue.');
  const actor = clean(input.actor, 100);
  if (actor.length < 2) throw new Error('A named case owner is required.');
  const category = String(input.category || '');
  if (!CASE_REOPEN_CATEGORIES.includes(category)) throw new Error('Choose a valid case reopening reason.');
  const priority = String(input.priority || 'normal').toLowerCase();
  if (!CASE_FOLLOWUP_PRIORITIES.includes(priority)) throw new Error('Choose urgent or normal follow-up priority.');
  const reason = clean(input.reason, 500);
  if (reason.length < 20) throw new Error('Explain why the case must be reopened in at least 20 characters.');
  const now = safeNow(options.now);
  const reopenCount = record.lifecycle.reopenCount + 1;
  const targetMinutes = priority === 'urgent' ? 30 : 120;
  const due = fromAbsoluteMinute(absoluteMinute(clock) + targetMinutes);
  const reference = clean(record.reference || record.contactId || `CASE-${reopenCount}`, 100).replace(/[^a-zA-Z0-9_-]/g, '-');
  const followUp = {
    id: `CFU-${reference}-${reopenCount}`,
    status: 'open',
    priority,
    dueDay: due.day,
    dueMinute: due.minutes,
    owner: actor,
    openedBy: actor,
    reasonCategory: category,
    reason,
    attempts: 0,
    claimedBy: '',
    claimedAt: null,
    openedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    lastOutcome: '',
    lastSummary: '',
    history: []
  };
  appendHistory(followUp, { at: now.toISOString(), action: 'reopened', actor, category, priority, reason, dueDay: due.day, dueMinute: due.minutes });
  record.lifecycle.reopenCount = reopenCount;
  record.lifecycle.followUp = followUp;
  record.lifecycle.history.unshift({ at: now.toISOString(), action: 'case_reopened', actor, reason, category, followUpId: followUp.id });
  record.lifecycle.history = record.lifecycle.history.slice(0, MAX_HISTORY);
  record.status = 'Reopened · follow-up due';
  record.reopenedAt = now.toISOString();
  record.reopenReason = reason;
  return { caseRecord: record, followUp, due, slaMinutes: targetMinutes };
}

export function caseFollowUpRisk(caseRecord, clockInput = {}) {
  const record = normalizeCaseLifecycle(caseRecord);
  const followUp = record.lifecycle.followUp;
  if (!followUp) return { state: 'none', deltaMinutes: null, active: false };
  if (followUp.status === 'complete') return { state: 'complete', deltaMinutes: null, active: false };
  if (followUp.status === 'supervisor_review') return { state: 'supervisor_review', deltaMinutes: null, active: true };
  let clock;
  try { clock = normalizeClock(clockInput); } catch (_) { return { state: 'clock_unavailable', deltaMinutes: null, active: true }; }
  if (!clock.active) return { state: 'paused_off_shift', deltaMinutes: null, active: true };
  const deltaMinutes = (followUp.dueDay - clock.day) * 1440 + followUp.dueMinute - clock.minutes;
  const state = deltaMinutes < 0 ? 'overdue' : deltaMinutes <= 15 ? 'due_soon' : 'on_track';
  return { state, deltaMinutes, active: true };
}

export function startCaseFollowUp(caseRecord, input = {}, clockInput = {}, options = {}) {
  const record = normalizeCaseLifecycle(caseRecord);
  const followUp = record.lifecycle.followUp;
  if (!followUp || followUp.status !== 'open') throw new Error('There is no open follow-up waiting to be claimed.');
  const clock = normalizeClock(clockInput);
  if (!clock.active) throw new Error('Start an active shift before claiming reopened case work.');
  const actor = clean(input.actor, 100);
  if (actor.length < 2) throw new Error('A named employee is required to claim this follow-up.');
  const now = safeNow(options.now);
  followUp.status = 'in_progress';
  followUp.claimedBy = actor;
  followUp.claimedAt = now.toISOString();
  followUp.updatedAt = now.toISOString();
  appendHistory(followUp, { at: now.toISOString(), action: 'follow_up_started', actor });
  record.lifecycle.history.unshift({ at: now.toISOString(), action: 'follow_up_started', actor, followUpId: followUp.id });
  record.lifecycle.history = record.lifecycle.history.slice(0, MAX_HISTORY);
  record.status = 'Reopened · follow-up in progress';
  return followUp;
}

export function completeCaseFollowUp(caseRecord, input = {}, clockInput = {}, options = {}) {
  const record = normalizeCaseLifecycle(caseRecord);
  const followUp = record.lifecycle.followUp;
  if (!followUp || followUp.status !== 'in_progress') throw new Error('Claim the reopened case follow-up before recording its outcome.');
  const clock = normalizeClock(clockInput);
  if (!clock.active) throw new Error('An active shift is required to complete reopened case work.');
  const actor = clean(input.actor, 100);
  if (actor.length < 2 || actor.toLowerCase() !== followUp.claimedBy.toLowerCase()) throw new Error('Only the employee who claimed this follow-up can complete it.');
  const outcome = String(input.outcome || '');
  if (!CASE_FOLLOWUP_OUTCOMES.includes(outcome)) throw new Error('Choose a valid reopened-case outcome.');
  const summary = clean(input.summary, 1000);
  if (summary.length < 30) throw new Error('Record at least 30 characters of factual follow-up evidence.');
  const now = safeNow(options.now);
  followUp.attempts += 1;
  followUp.lastOutcome = outcome;
  followUp.lastSummary = summary;
  followUp.updatedAt = now.toISOString();
  if (outcome === 'resolved') {
    if (input.customerConfirmed !== true) throw new Error('Customer confirmation is required before closing a reopened case as resolved.');
    followUp.status = 'complete';
    followUp.completedAt = now.toISOString();
    followUp.customerConfirmed = true;
    followUp.resolutionEvidence = summary;
    record.status = 'Resolved after reopened follow-up';
    record.disposition = 'reopened_resolved';
    record.resolutionVerifiedAt = now.toISOString();
  } else if (outcome === 'pending_customer') {
    const due = fromAbsoluteMinute(absoluteMinute(clock) + 1440);
    followUp.status = 'open';
    followUp.claimedBy = '';
    followUp.claimedAt = null;
    followUp.dueDay = due.day;
    followUp.dueMinute = 600;
    followUp.priority = 'normal';
    followUp.customerConfirmed = false;
    record.status = 'Pending customer response after reopen';
  } else {
    followUp.status = 'supervisor_review';
    followUp.reviewReason = summary;
    record.status = 'Reopened case · supervisor review';
  }
  appendHistory(followUp, { at: now.toISOString(), action: `follow_up_${outcome}`, actor, summary, customerConfirmed: input.customerConfirmed === true, dueDay: followUp.dueDay, dueMinute: followUp.dueMinute });
  record.lifecycle.history.unshift({ at: now.toISOString(), action: `follow_up_${outcome}`, actor, followUpId: followUp.id });
  record.lifecycle.history = record.lifecycle.history.slice(0, MAX_HISTORY);
  return { caseRecord: record, followUp, outcome, due: outcome === 'pending_customer' ? { day: followUp.dueDay, minutes: followUp.dueMinute } : null };
}

export function reviewCaseFollowUp(caseRecord, input = {}, clockInput = {}, options = {}) {
  const record = normalizeCaseLifecycle(caseRecord);
  const followUp = record.lifecycle.followUp;
  if (!followUp || followUp.status !== 'supervisor_review') throw new Error('This case is not awaiting supervisor review.');
  const clock = normalizeClock(clockInput);
  if (!clock.active) throw new Error('An active shift is required for supervisor case review.');
  const reviewer = clean(input.reviewer, 100);
  if (reviewer.length < 2) throw new Error('Enter the reviewing supervisor name.');
  const originalOwner = clean(followUp.owner || record.owner, 100);
  if (originalOwner && reviewer.toLowerCase() === originalOwner.toLowerCase()) throw new Error('The reviewer must be independent of the original case owner.');
  const decision = String(input.decision || '');
  if (!CASE_FOLLOWUP_DECISIONS.includes(decision)) throw new Error('Choose a valid supervisor decision.');
  const summary = clean(input.summary, 1000);
  if (summary.length < 30) throw new Error('Document at least 30 characters of supervisor review evidence.');
  const now = safeNow(options.now);
  followUp.reviewedBy = reviewer;
  followUp.reviewedAt = now.toISOString();
  followUp.reviewNotes = summary;
  followUp.updatedAt = now.toISOString();
  if (decision === 'close_after_review') {
    if (input.customerConfirmed !== true) throw new Error('Customer confirmation is required before a supervisor closes the reopened case.');
    followUp.status = 'complete';
    followUp.completedAt = now.toISOString();
    followUp.customerConfirmed = true;
    followUp.resolutionEvidence = summary;
    record.status = 'Resolved after supervisor verification';
    record.disposition = 'supervisor_verified_resolution';
    record.resolutionVerifiedAt = now.toISOString();
  } else {
    const due = fromAbsoluteMinute(absoluteMinute(clock) + 30);
    followUp.status = 'open';
    followUp.priority = 'urgent';
    followUp.dueDay = due.day;
    followUp.dueMinute = due.minutes;
    followUp.claimedBy = '';
    followUp.claimedAt = null;
    record.status = 'Reopened · returned to agent';
    followUp.owner = clean(input.returnTo || followUp.owner || record.owner, 100);
  }
  appendHistory(followUp, { at: now.toISOString(), action: `supervisor_${decision}`, reviewer, summary, customerConfirmed: input.customerConfirmed === true });
  record.lifecycle.history.unshift({ at: now.toISOString(), action: `supervisor_${decision}`, reviewer, followUpId: followUp.id });
  record.lifecycle.history = record.lifecycle.history.slice(0, MAX_HISTORY);
  return { caseRecord: record, followUp, decision };
}

export function caseFollowUpMetrics(cases = [], clockInput = {}) {
  const rows = (Array.isArray(cases) ? cases : []).filter(row => {
    try { return Boolean(normalizeCaseLifecycle(row).lifecycle.followUp); } catch (_) { return false; }
  }).map(row => ({ caseRecord: row, followUp: row.lifecycle.followUp, risk: caseFollowUpRisk(row, clockInput) }))
    .filter(row => row.followUp.status !== 'complete')
    .sort((a, b) => {
      const rank = { supervisor_review: 0, overdue: 1, due_soon: 2, on_track: 3, paused_off_shift: 4, clock_unavailable: 5 };
      return (rank[a.risk.state] ?? 6) - (rank[b.risk.state] ?? 6) || a.followUp.dueDay - b.followUp.dueDay || a.followUp.dueMinute - b.followUp.dueMinute;
    });
  return {
    open: rows.length,
    urgent: rows.filter(row => row.followUp.priority === 'urgent').length,
    overdue: rows.filter(row => row.risk.state === 'overdue').length,
    dueSoon: rows.filter(row => row.risk.state === 'due_soon').length,
    supervisorReview: rows.filter(row => row.followUp.status === 'supervisor_review').length,
    inProgress: rows.filter(row => row.followUp.status === 'in_progress').length,
    rows
  };
}
