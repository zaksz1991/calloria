const CASE_FOLLOWUP_OUTCOMES = ['resolved', 'pending_customer', 'escalated'];
const CASE_FOLLOWUP_DECISIONS = ['return_to_agent', 'close_after_review'];
function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
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
function absoluteMinute(clock) { return (clock.day - 1) * 1440 + clock.minutes; }
function fromAbsoluteMinute(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  return { day: Math.floor(total / 1440) + 1, minutes: total % 1440 };
}
function appendHistory(followUp, event) {
  followUp.history = Array.isArray(followUp.history) ? followUp.history : [];
  followUp.history.unshift(event);
  followUp.history = followUp.history.slice(0, 30);
}
export function normalizeCaseLifecycle(caseRecord) {
  const lifecycle = caseRecord.lifecycle && typeof caseRecord.lifecycle === 'object' ? caseRecord.lifecycle : {};
  lifecycle.version = '6.71.0';
  lifecycle.reopenCount = Math.max(0, Math.min(5, Math.floor(Number(lifecycle.reopenCount) || 0)));
  lifecycle.history = Array.isArray(lifecycle.history) ? lifecycle.history.slice(0, 30) : [];
  if (lifecycle.followUp && typeof lifecycle.followUp === 'object') {
    const followUp = lifecycle.followUp;
    followUp.id = clean(followUp.id, 120);
    followUp.status = ['open', 'in_progress', 'supervisor_review', 'complete'].includes(followUp.status) ? followUp.status : 'open';
    followUp.priority = ['urgent', 'normal'].includes(followUp.priority) ? followUp.priority : 'normal';
    followUp.dueDay = Math.max(1, Math.floor(Number(followUp.dueDay) || 1));
    followUp.dueMinute = Math.max(0, Math.min(1439, Math.floor(Number(followUp.dueMinute) || 0)));
    followUp.owner = clean(followUp.owner, 100);
    followUp.openedBy = clean(followUp.openedBy, 100);
    followUp.reasonCategory = clean(followUp.reasonCategory, 80) || 'customer-says-unresolved';
    followUp.reason = clean(followUp.reason, 500);
    followUp.attempts = Math.max(0, Math.min(50, Math.floor(Number(followUp.attempts) || 0)));
    followUp.claimedBy = clean(followUp.claimedBy, 100);
    followUp.history = Array.isArray(followUp.history) ? followUp.history.slice(0, 30) : [];
  } else lifecycle.followUp = null;
  caseRecord.lifecycle = lifecycle;
  return caseRecord;
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
  record.lifecycle.history = record.lifecycle.history.slice(0, 30);
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
  record.lifecycle.history = record.lifecycle.history.slice(0, 30);
  return { caseRecord: record, followUp, decision };
}
