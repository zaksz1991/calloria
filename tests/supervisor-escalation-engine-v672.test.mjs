import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSupervisorEscalation,
  normalizeSupervisorRequests,
  assessSupervisorEscalation,
  claimSupervisorEscalation,
  reassignSupervisorEscalation,
  resolveSupervisorEscalation,
  closeLinkedSupervisorEscalation,
  supervisorEscalationMetrics
} from '../js/supervisor-escalation-engine.js';

const baseTime = new Date('2026-11-18T10:00:00.000Z');
const makeRequest = (overrides = {}) => ({
  id: 'SUP-001',
  status: 'open',
  reference: 'CASE-1001',
  contactId: 'CONTACT-1001',
  customer: 'Synthetic Customer',
  reason: 'Agent requested supervisor assistance during a customer contact.',
  channel: 'Inbound voice',
  createdAt: baseTime.toISOString(),
  ...overrides
});

test('legacy request normalisation adds escalation metadata without removing the legacy request fields', () => {
  const request = makeRequest({ customField: 'retained' });
  normalizeSupervisorEscalation(request, baseTime);
  assert.equal(request.status, 'open');
  assert.equal(request.customField, 'retained');
  assert.equal(request.escalation.version, '6.72.0');
  assert.equal(request.escalation.priority, 'normal');
  assert.equal(request.escalation.targetMinutes, 30);
  assert.equal(request.escalation.stage, 'new');
  assert.equal(request.escalation.assignedTo, '');
});

test('security, case/callback and ordinary assistance requests receive distinct default priorities', () => {
  const security = normalizeSupervisorEscalation(makeRequest({ reason: 'Critical security breach: customer asked for an OTP disclosure.' }), baseTime);
  const caseFollowUp = normalizeSupervisorEscalation(makeRequest({ reason: 'Reopened case follow-up requires independent supervisor decision.' }), baseTime);
  const ordinary = normalizeSupervisorEscalation(makeRequest({ reason: 'Agent requests help clarifying an account service process.' }), baseTime);
  assert.deepEqual([security.escalation.priority, security.escalation.targetMinutes], ['critical', 5]);
  assert.deepEqual([caseFollowUp.escalation.priority, caseFollowUp.escalation.targetMinutes], ['high', 15]);
  assert.deepEqual([ordinary.escalation.priority, ordinary.escalation.targetMinutes], ['normal', 30]);
});

test('normalisation preserves existing explicit priority and target overrides within bounds', () => {
  const request = makeRequest({ escalation: { priority: 'high', targetMinutes: 22, assignedTo: 'Amina', stage: 'acknowledged' } });
  normalizeSupervisorEscalation(request, baseTime);
  assert.equal(request.escalation.priority, 'high');
  assert.equal(request.escalation.targetMinutes, 22);
  assert.equal(request.escalation.assignedTo, 'Amina');
  assert.equal(request.escalation.stage, 'acknowledged');
});

test('request risk changes from on-track to due-soon and overdue against its response target', () => {
  const request = makeRequest({ reason: 'Security review required.' });
  assert.equal(assessSupervisorEscalation(request, new Date('2026-11-18T10:00:30.000Z')).state, 'on_track');
  assert.equal(assessSupervisorEscalation(request, new Date('2026-11-18T10:03:50.000Z')).state, 'due_soon');
  assert.equal(assessSupervisorEscalation(request, new Date('2026-11-18T10:05:01.000Z')).state, 'overdue');
});

test('resolved requests no longer breach their response clock', () => {
  const request = makeRequest({ status: 'resolved', resolvedAt: '2026-11-18T10:04:00.000Z' });
  assert.equal(assessSupervisorEscalation(request, new Date('2026-11-18T12:00:00.000Z')).state, 'resolved');
});

test('request batch normalisation ignores invalid rows and preserves valid order', () => {
  const rows = normalizeSupervisorRequests([null, makeRequest({ id: 'SUP-A' }), {}, makeRequest({ id: 'SUP-B' })], baseTime);
  assert.deepEqual(rows.map(row => row.id), ['SUP-A', 'SUP-B']);
  assert.equal(rows[0].escalation.stage, 'new');
});

test('a named supervisor can claim an unassigned request and ownership is visible', () => {
  const requests = [makeRequest()];
  const claimed = claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime);
  assert.equal(claimed.escalation.assignedTo, 'Amina Yusuf');
  assert.equal(claimed.escalation.stage, 'in_progress');
  assert.ok(claimed.escalation.acknowledgedAt);
  assert.ok(claimed.escalation.startedAt);
  assert.deepEqual(claimed.escalation.history.map(item => item.action), ['review_started', 'claimed']);
});

test('claiming requires a named owner and rejects a different supervisor', () => {
  const requests = [makeRequest()];
  assert.throws(() => claimSupervisorEscalation(requests, 'SUP-001', '', baseTime), /name of the supervisor/i);
  claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => claimSupervisorEscalation(requests, 'SUP-001', 'Tunde Bello', baseTime), /already owned by Amina Yusuf/i);
});

test('claiming a resolved or unknown request is rejected', () => {
  const requests = [makeRequest({ status: 'resolved' })];
  assert.throws(() => claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime), /no longer open/i);
  assert.throws(() => claimSupervisorEscalation(requests, 'SUP-MISSING', 'Amina Yusuf', baseTime), /no longer open/i);
});

test('reassignment requires current ownership, a different owner and a reason', () => {
  const requests = [makeRequest()];
  claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => reassignSupervisorEscalation(requests, 'SUP-001', 'Tunde Bello', { newOwner: 'Musa', reason: 'handover' }, baseTime), /currently assigned supervisor/i);
  assert.throws(() => reassignSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { newOwner: 'Amina Yusuf', reason: 'handover reason' }, baseTime), /different supervisor/i);
  assert.throws(() => reassignSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { newOwner: 'Musa Bello', reason: 'short' }, baseTime), /at least 8 characters/i);
  const reassigned = reassignSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { newOwner: 'Musa Bello', reason: 'Specialist queue coverage required.' }, baseTime);
  assert.equal(reassigned.escalation.assignedTo, 'Musa Bello');
  assert.equal(reassigned.escalation.stage, 'acknowledged');
  assert.equal(reassigned.escalation.history[0].action, 'reassigned');
});

test('a supervisor cannot resolve an escalation they have not claimed', () => {
  const requests = [makeRequest()];
  assert.throws(() => resolveSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { outcome: 'action_taken', evidence: 'Reviewed the customer record and confirmed a safe next step.' }, baseTime), /Claim this escalation/i);
});

test('generic escalation resolution requires valid decision and 30 characters of evidence', () => {
  const requests = [makeRequest()];
  claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => resolveSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { outcome: 'unknown', evidence: 'A sufficiently long explanation that should still fail.' }, baseTime), /valid supervisor resolution/i);
  assert.throws(() => resolveSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { outcome: 'action_taken', evidence: 'Too short.' }, baseTime), /at least 30 characters/i);
  const resolved = resolveSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', { outcome: 'action_taken', evidence: 'Reviewed the case history, contacted the agent and recorded the approved recovery action.' }, baseTime);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.escalation.stage, 'resolved');
  assert.equal(resolved.escalation.resolvedBy, 'Amina Yusuf');
  assert.equal(resolved.escalation.history[0].action, 'resolved');
});

test('a different supervisor cannot resolve an escalation owned by another supervisor', () => {
  const requests = [makeRequest()];
  claimSupervisorEscalation(requests, 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => resolveSupervisorEscalation(requests, 'SUP-001', 'Tunde Bello', { outcome: 'action_taken', evidence: 'Reviewed the file and recorded the required intervention.' }, baseTime), /Claim this escalation/i);
});

test('linked CRM or callback workflow closure records evidence and respects assigned ownership', () => {
  const request = makeRequest({ caseReference: 'CASE-1001' });
  claimSupervisorEscalation([request], 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => closeLinkedSupervisorEscalation(request, { actor: 'Tunde Bello', evidence: 'Independent review found the case record and customer confirmation.' }, baseTime), /assigned to Amina Yusuf/i);
  const closed = closeLinkedSupervisorEscalation(request, { actor: 'Amina Yusuf', evidence: 'Independent review checked the case record and verified the customer confirmation.' }, baseTime);
  assert.equal(closed.status, 'resolved');
  assert.equal(closed.escalation.resolution, 'linked_workflow_review');
  assert.equal(closed.escalation.history[0].action, 'linked_workflow_resolved');
});

test('linked workflow closure requires a claimed request, named reviewer and review evidence', () => {
  const request = makeRequest();
  assert.throws(() => closeLinkedSupervisorEscalation(request, { actor: 'Amina Yusuf', evidence: 'Review evidence is recorded in the case file.' }, baseTime), /claim this escalation/i);
  claimSupervisorEscalation([request], 'SUP-001', 'Amina Yusuf', baseTime);
  assert.throws(() => closeLinkedSupervisorEscalation(request, { actor: '', evidence: 'Review evidence is recorded in the case file.' }, baseTime), /named supervisor reviewer/i);
  assert.throws(() => closeLinkedSupervisorEscalation(request, { actor: 'Amina Yusuf', evidence: 'short' }, baseTime), /at least 20 characters/i);
});


test('promise escalation closed by its domain engine receives matching supervisor audit closure', () => {
  const request = makeRequest({ status: 'open' });
  claimSupervisorEscalation([request], 'SUP-001', 'Amina Yusuf', baseTime);
  // PromiseControlEngine records the domain decision first; this bridge synchronises the shared escalation metadata.
  request.status = 'resolved';
  request.resolvedAt = new Date('2026-11-18T10:02:00.000Z').toISOString();
  const closed = closeLinkedSupervisorEscalation(request, { actor: 'Amina Yusuf', evidence: 'Recovery action was recorded; the underlying customer promise remains open.' }, new Date('2026-11-18T10:02:00.000Z'));
  assert.equal(closed.status, 'resolved');
  assert.equal(closed.escalation.stage, 'resolved');
  assert.equal(closed.escalation.resolvedBy, 'Amina Yusuf');
  assert.equal(closed.escalation.history[0].action, 'linked_workflow_resolved');
});

test('metrics summarise unassigned, severity, response risk, in-progress and resolved work', () => {
  const requests = [
    makeRequest({ id: 'SUP-CRIT', reason: 'Critical security review required.' }),
    makeRequest({ id: 'SUP-HIGH', reason: 'Reopened case follow-up requires a supervisor.' }),
    makeRequest({ id: 'SUP-OVERDUE', reason: 'Security breach review required.', createdAt: '2026-11-18T09:50:00.000Z' }),
    makeRequest({ id: 'SUP-DONE', status: 'resolved' })
  ];
  claimSupervisorEscalation(requests, 'SUP-HIGH', 'Amina Yusuf', baseTime);
  const metrics = supervisorEscalationMetrics(requests, new Date('2026-11-18T10:06:00.000Z'));
  assert.equal(metrics.total, 4);
  assert.equal(metrics.active, 3);
  assert.equal(metrics.unassigned, 2);
  assert.equal(metrics.critical, 2);
  assert.equal(metrics.high, 1);
  assert.equal(metrics.overdue, 2);
  assert.equal(metrics.inProgress, 1);
  assert.equal(metrics.resolved, 1);
});
