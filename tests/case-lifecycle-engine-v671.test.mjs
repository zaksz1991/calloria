import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_LIFECYCLE_VERSION,
  CASE_REOPEN_CATEGORIES,
  MAX_CASE_REOPENS,
  normalizeCaseLifecycle,
  caseReopenEligibility,
  reopenCase,
  caseFollowUpRisk,
  startCaseFollowUp,
  completeCaseFollowUp,
  reviewCaseFollowUp,
  caseFollowUpMetrics,
  formatCaseClock
} from '../js/case-lifecycle-engine.js';

const fixedNow = new Date('2026-11-18T10:00:00.000Z');
const activeClock = { day: 3, minutes: 9 * 60, active: true };
function resolvedCase(overrides = {}) {
  return {
    reference: 'CASE-1001',
    contactId: 'CONTACT-1001',
    customer: 'Amina Bello',
    title: 'Transfer not received',
    channel: 'Inbound',
    status: 'Resolved',
    disposition: 'resolved',
    owner: 'Agent One',
    notes: 'Original interaction notes describe the transfer investigation.',
    ...overrides
  };
}
function reopen(record = resolvedCase(), overrides = {}) {
  return reopenCase(record, {
    actor: 'Agent One',
    category: 'customer-says-unresolved',
    priority: 'urgent',
    reason: 'Customer contacted again and confirmed the original transfer issue remains unresolved.',
    ...overrides
  }, activeClock, { now: fixedNow });
}

test('v6.71 exposes the expected lifecycle version and bounded reopen policy', () => {
  assert.equal(CASE_LIFECYCLE_VERSION, '6.71.0');
  assert.equal(MAX_CASE_REOPENS, 5);
  assert.equal(CASE_REOPEN_CATEGORIES.length, 5);
});

test('legacy cases are normalised without changing their original resolution', () => {
  const record = resolvedCase();
  const normalized = normalizeCaseLifecycle(record);
  assert.equal(normalized.status, 'Resolved');
  assert.equal(normalized.lifecycle.version, CASE_LIFECYCLE_VERSION);
  assert.equal(normalized.lifecycle.reopenCount, 0);
  assert.equal(normalized.lifecycle.followUp, null);
  assert.equal(caseReopenEligibility(normalized).eligible, true);
});

test('only previously resolved or completed cases can be reopened', () => {
  assert.equal(caseReopenEligibility(resolvedCase({ status: 'Escalated / review required' })).eligible, false);
  assert.equal(caseReopenEligibility(resolvedCase({ status: 'Customer declined' })).eligible, false);
  assert.equal(caseReopenEligibility(resolvedCase({ status: 'Resolved' })).eligible, true);
});

test('reopening validates actor, category, priority and reason', () => {
  assert.throws(() => reopenCase(resolvedCase(), { actor: 'A', category: CASE_REOPEN_CATEGORIES[0], priority: 'urgent', reason: 'This reason is sufficiently long for this test.' }, activeClock), /named case owner/);
  assert.throws(() => reopenCase(resolvedCase(), { actor: 'Agent One', category: 'invalid', priority: 'urgent', reason: 'This reason is sufficiently long for this test.' }, activeClock), /valid case reopening reason/);
  assert.throws(() => reopenCase(resolvedCase(), { actor: 'Agent One', category: CASE_REOPEN_CATEGORIES[0], priority: 'critical', reason: 'This reason is sufficiently long for this test.' }, activeClock), /urgent or normal/);
  assert.throws(() => reopenCase(resolvedCase(), { actor: 'Agent One', category: CASE_REOPEN_CATEGORIES[0], priority: 'urgent', reason: 'Too short.' }, activeClock), /20 characters/);
  assert.throws(() => reopenCase(resolvedCase(), { actor: 'Agent One', category: CASE_REOPEN_CATEGORIES[0], priority: 'urgent', reason: 'Customer says this issue remains open after previous contact.' }, { ...activeClock, active: false }), /active shift/);
});

test('urgent and normal reopenings receive bounded simulated SLA targets', () => {
  const urgentCase = resolvedCase({ reference: 'CASE-URGENT' });
  const urgent = reopen(urgentCase);
  assert.equal(urgent.slaMinutes, 30);
  assert.deepEqual(urgent.due, { day: 3, minutes: 570 });
  assert.equal(urgentCase.status, 'Reopened · follow-up due');
  assert.equal(urgentCase.lifecycle.reopenCount, 1);
  const normalCase = resolvedCase({ reference: 'CASE-NORMAL' });
  const normal = reopen(normalCase, { priority: 'normal' });
  assert.equal(normal.slaMinutes, 120);
  assert.deepEqual(normal.due, { day: 3, minutes: 660 });
  assert.match(normal.followUp.id, /^CFU-CASE-NORMAL-1$/);
});

test('reopen due-time calculation rolls into the next simulated day', () => {
  const record = resolvedCase({ reference: 'CASE-LATE' });
  const result = reopenCase(record, {
    actor: 'Agent One', category: 'repeat-contact', priority: 'urgent',
    reason: 'Customer made a repeat contact because the earlier resolution did not hold.'
  }, { day: 4, minutes: 23 * 60 + 50, active: true }, { now: fixedNow });
  assert.deepEqual(result.due, { day: 5, minutes: 20 });
  assert.equal(formatCaseClock(result.due.minutes), '00:20');
});

test('an active follow-up prevents duplicate reopening', () => {
  const record = resolvedCase();
  reopen(record);
  assert.equal(caseReopenEligibility(record).eligible, false);
  assert.throws(() => reopen(record), /already has an active follow-up/);
});

test('follow-up risk respects due-soon, overdue, supervisor and off-shift states', () => {
  const record = resolvedCase();
  reopen(record);
  assert.equal(caseFollowUpRisk(record, { day: 3, minutes: 8 * 60 + 50, active: true }).state, 'on_track');
  assert.equal(caseFollowUpRisk(record, { day: 3, minutes: 9 * 60 + 20, active: true }).state, 'due_soon');
  assert.equal(caseFollowUpRisk(record, { day: 3, minutes: 9 * 60 + 31, active: true }).state, 'overdue');
  assert.equal(caseFollowUpRisk(record, { day: 3, minutes: 9 * 60, active: false }).state, 'paused_off_shift');
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'escalated', summary: 'The underlying issue requires specialist authority and an independent review.' }, activeClock, { now: fixedNow });
  assert.equal(caseFollowUpRisk(record, activeClock).state, 'supervisor_review');
});

test('only the employee who claimed the follow-up can complete it', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  assert.throws(() => completeCaseFollowUp(record, { actor: 'Agent Two', outcome: 'resolved', customerConfirmed: true, summary: 'The customer confirmed the issue is fixed and the service is restored.' }, activeClock, { now: fixedNow }), /Only the employee/);
});

test('a reopened case cannot be marked resolved without customer confirmation and factual evidence', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  assert.throws(() => completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'resolved', customerConfirmed: false, summary: 'The agent completed the checks and updated the service request successfully.' }, activeClock, { now: fixedNow }), /Customer confirmation is required/);
  assert.throws(() => completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'resolved', customerConfirmed: true, summary: 'Resolved.' }, activeClock, { now: fixedNow }), /30 characters/);
  assert.equal(record.lifecycle.followUp.status, 'in_progress');
});

test('customer-confirmed resolution closes the follow-up and preserves evidence', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'resolved', customerConfirmed: true,
    summary: 'The receiving institution trace was completed, funds were located, and the customer confirmed access.'
  }, activeClock, { now: fixedNow });
  assert.equal(result.followUp.status, 'complete');
  assert.equal(record.status, 'Resolved after reopened follow-up');
  assert.equal(record.disposition, 'reopened_resolved');
  assert.equal(record.lifecycle.followUp.customerConfirmed, true);
  assert.match(record.lifecycle.followUp.resolutionEvidence, /customer confirmed/);
  assert.equal(caseReopenEligibility(record).eligible, true);
});

test('pending customer outcome schedules a fresh next-day follow-up without closing the case', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'pending_customer', customerConfirmed: false,
    summary: 'The customer must provide the requested document before the investigation can continue.'
  }, activeClock, { now: fixedNow });
  assert.equal(result.followUp.status, 'open');
  assert.equal(result.followUp.dueDay, 4);
  assert.equal(result.followUp.dueMinute, 600);
  assert.equal(record.status, 'Pending customer response after reopen');
  assert.equal(result.followUp.claimedBy, '');
});

test('escalated follow-up requires an independent supervisor decision', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'escalated', summary: 'The customer dispute requires specialist authority and a supervisor decision.' }, activeClock, { now: fixedNow });
  assert.throws(() => reviewCaseFollowUp(record, { reviewer: 'Agent One', decision: 'return_to_agent', summary: 'Reviewed this case and returned it to the original employee for more work.' }, activeClock, { now: fixedNow }), /independent/);
  const result = reviewCaseFollowUp(record, { reviewer: 'Supervisor Two', decision: 'return_to_agent', summary: 'Reviewed the evidence and assigned the next investigation step back to the original owner.' }, activeClock, { now: fixedNow });
  assert.equal(result.followUp.status, 'open');
  assert.equal(record.status, 'Reopened · returned to agent');
  assert.equal(result.followUp.priority, 'urgent');
});

test('supervisor closure also requires customer confirmation and documented evidence', () => {
  const record = resolvedCase();
  reopen(record);
  startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
  completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'escalated', summary: 'The customer dispute requires specialist authority and a supervisor decision.' }, activeClock, { now: fixedNow });
  assert.throws(() => reviewCaseFollowUp(record, { reviewer: 'Supervisor Two', decision: 'close_after_review', customerConfirmed: false, summary: 'The independent review checked the service restoration evidence and case notes.' }, activeClock, { now: fixedNow }), /Customer confirmation is required/);
  const result = reviewCaseFollowUp(record, { reviewer: 'Supervisor Two', decision: 'close_after_review', customerConfirmed: true, summary: 'The independent review verified the restoration evidence and the customer confirmed the service now works.' }, activeClock, { now: fixedNow });
  assert.equal(result.followUp.status, 'complete');
  assert.equal(record.status, 'Resolved after supervisor verification');
  assert.equal(record.lifecycle.followUp.customerConfirmed, true);
});

test('reopening is bounded and the metrics expose operational workload', () => {
  const record = resolvedCase();
  for (let index = 0; index < MAX_CASE_REOPENS; index += 1) {
    reopen(record, { reason: `Customer reports the same unresolved service issue on reopening ${index + 1}.` });
    startCaseFollowUp(record, { actor: 'Agent One' }, activeClock, { now: fixedNow });
    completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'resolved', customerConfirmed: true, summary: 'The customer confirmed the latest corrective action resolved the repeated service issue.' }, activeClock, { now: fixedNow });
  }
  assert.equal(caseReopenEligibility(record).eligible, false);
  assert.match(caseReopenEligibility(record).reason, /reopen limit/);
  const second = resolvedCase({ reference: 'CASE-SECOND' });
  reopen(second, { priority: 'normal' });
  const metrics = caseFollowUpMetrics([record, second], activeClock);
  assert.equal(metrics.open, 1);
  assert.equal(metrics.urgent, 0);
  assert.equal(metrics.rows[0].caseRecord.reference, 'CASE-SECOND');
});
