import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPERVISOR_HANDOVER_VERSION,
  normalizeSupervisorHandovers,
  supervisorHandoverCandidates,
  createSupervisorHandover,
  acceptSupervisorHandover,
  cancelSupervisorHandover,
  supervisorHandoverMetrics
} from '../js/supervisor-handover-engine.js';

const createdAt = '2026-11-18T08:00:00.000Z';
const now = new Date('2026-11-18T08:10:00.000Z');

function makeRequest(overrides = {}) {
  const request = {
    id: 'SUP-001',
    reference: 'CASE-001',
    contactId: 'CONTACT-001',
    customer: 'Ada Example',
    reason: 'Customer requires independent supervisor assistance after a failed resolution.',
    channel: 'Live chat',
    status: 'open',
    createdAt,
    escalation: {
      priority: 'high',
      targetMinutes: 15,
      assignedTo: 'Amina Yusuf',
      stage: 'in_progress',
      acknowledgedAt: createdAt,
      startedAt: createdAt,
      history: []
    },
    ...overrides
  };
  if (overrides.escalation) request.escalation = { ...request.escalation, ...overrides.escalation };
  return request;
}

function createOne(requests = [makeRequest()], handovers = []) {
  const handover = createSupervisorHandover(requests, handovers, {
    fromSupervisor: 'Amina Yusuf',
    toSupervisor: 'Bello Musa',
    note: 'Customer escalation is still awaiting a verified outcome; continue the agreed recovery checks.'
  }, now);
  handovers.push(handover);
  return handover;
}

test('normalisation preserves legacy handover fields and canonicalises unknown status', () => {
  const handovers = normalizeSupervisorHandovers([{
    id: 'HO-LEGACY', fromSupervisor: 'Amina Yusuf', toSupervisor: 'Bello Musa',
    createdAt, status: 'unknown', note: 'Existing handover note with enough detail.',
    items: [{ requestId: 'SUP-OLD', status: 'unknown', customer: 'Legacy customer' }]
  }], now);
  assert.equal(handovers.length, 1);
  assert.equal(handovers[0].version, SUPERVISOR_HANDOVER_VERSION);
  assert.equal(handovers[0].status, 'pending_acceptance');
  assert.equal(handovers[0].items[0].status, 'pending');
  assert.equal(handovers[0].items[0].originalOwner, 'Amina Yusuf');
});

test('candidates include only open requests owned by outgoing supervisor and exclude pending transfers', () => {
  const requests = [
    makeRequest({ id: 'SUP-CRIT', escalation: { priority: 'critical', assignedTo: 'Amina Yusuf' } }),
    makeRequest({ id: 'SUP-OTHER', escalation: { assignedTo: 'Bello Musa' } }),
    makeRequest({ id: 'SUP-CLOSED', status: 'resolved', escalation: { assignedTo: 'Amina Yusuf' } })
  ];
  const candidates = supervisorHandoverCandidates(requests, [], 'Amina Yusuf', now);
  assert.deepEqual(candidates.map(item => item.requestId), ['SUP-CRIT']);
  const first = createOne([requests[0]], []);
  const candidatesForSecondHandover = supervisorHandoverCandidates([requests[0]], [first], 'Amina Yusuf', now);
  assert.equal(candidatesForSecondHandover.length, 0);
});

test('creation requires distinct named supervisors, a meaningful note and eligible owned work', () => {
  const requests = [makeRequest()];
  const base = { fromSupervisor: 'Amina Yusuf', toSupervisor: 'Bello Musa', note: 'This handover includes actions and customer risk that remain outstanding.' };
  assert.throws(() => createSupervisorHandover(requests, [], { ...base, toSupervisor: 'Amina Yusuf' }, now), /different from the outgoing/i);
  assert.throws(() => createSupervisorHandover(requests, [], { ...base, note: 'Too short' }, now), /at least 20 characters/i);
  assert.throws(() => createSupervisorHandover([makeRequest({ escalation: { assignedTo: 'Bello Musa' } })], [], base, now), /no eligible open escalations/i);
  assert.equal(createSupervisorHandover(requests, [], base, now).items.length, 1);
});

test('acceptance transfers only still-open items and appends ownership history', () => {
  const requests = [makeRequest(), makeRequest({ id: 'SUP-002', reference: 'CASE-002' })];
  const handover = createOne(requests, []);
  const result = acceptSupervisorHandover(requests, [handover], handover.id, 'Bello Musa', new Date('2026-11-18T08:20:00.000Z'));
  assert.equal(result.transferred, 2);
  assert.equal(result.stale, 0);
  assert.equal(handover.status, 'accepted');
  assert.equal(handover.acceptedBy, 'Bello Musa');
  assert.equal(requests[0].escalation.assignedTo, 'Bello Musa');
  assert.equal(requests[0].escalation.stage, 'acknowledged');
  assert.equal(requests[0].escalation.startedAt, null);
  assert.equal(requests[0].escalation.history[0].action, 'shift_handover_accepted');
  assert.equal(requests[0].escalation.history[0].handoverId, handover.id);
  assert.equal(handover.items.every(item => item.status === 'transferred'), true);
});

test('acceptance skips resolved, missing and reassigned requests without overwriting their current owner', () => {
  const requests = [
    makeRequest({ id: 'SUP-OPEN' }),
    makeRequest({ id: 'SUP-CLOSED' }),
    makeRequest({ id: 'SUP-REASSIGNED' })
  ];
  const handover = createOne(requests, []);
  requests[1].status = 'resolved';
  requests[2].escalation.assignedTo = 'Another Supervisor';
  handover.items.push({ requestId: 'SUP-MISSING', originalOwner: 'Amina Yusuf', status: 'pending' });
  const result = acceptSupervisorHandover(requests, [handover], handover.id, 'Bello Musa', now);
  assert.equal(result.transferred, 1);
  assert.equal(result.stale, 3);
  assert.equal(requests[2].escalation.assignedTo, 'Another Supervisor');
  assert.equal(handover.items.find(item => item.requestId === 'SUP-MISSING').status, 'stale');
});

test('only the named incoming supervisor can accept a pending handover', () => {
  const handover = createOne([makeRequest()], []);
  assert.throws(() => acceptSupervisorHandover([makeRequest()], [handover], handover.id, 'Other Person', now), /must be accepted by Bello Musa/i);
  assert.equal(handover.status, 'pending_acceptance');
});

test('outgoing supervisor can cancel a pending handover with a reason and ownership stays unchanged', () => {
  const request = makeRequest();
  const handover = createOne([request], []);
  assert.throws(() => cancelSupervisorHandover([handover], handover.id, 'Bello Musa', 'Changed plan', now), /only the outgoing supervisor/i);
  assert.throws(() => cancelSupervisorHandover([handover], handover.id, 'Amina Yusuf', 'short', now), /at least 10 characters/i);
  const cancelled = cancelSupervisorHandover([handover], handover.id, 'Amina Yusuf', 'Incoming supervisor is unavailable for this shift.', now);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(request.escalation.assignedTo, 'Amina Yusuf');
  assert.equal(cancelled.items[0].status, 'stale');
});

test('accepted and cancelled handovers cannot be accepted or cancelled again', () => {
  const request = makeRequest();
  const handover = createOne([request], []);
  acceptSupervisorHandover([request], [handover], handover.id, 'Bello Musa', now);
  assert.throws(() => acceptSupervisorHandover([request], [handover], handover.id, 'Bello Musa', now), /only a pending handover/i);
  assert.throws(() => cancelSupervisorHandover([handover], handover.id, 'Amina Yusuf', 'No longer needed for this shift.', now), /only a pending handover/i);
});

test('metrics count pending, accepted, cancelled and item outcomes', () => {
  const pendingRequests = [makeRequest()];
  const pending = createOne(pendingRequests, []);
  const acceptedRequests = [makeRequest({ id: 'SUP-ACCEPTED' })];
  const accepted = createOne(acceptedRequests, [pending]);
  acceptSupervisorHandover(acceptedRequests, [accepted], accepted.id, 'Bello Musa', now);
  const cancelledRequests = [makeRequest({ id: 'SUP-CANCELLED' })];
  const cancelled = createOne(cancelledRequests, [pending, accepted]);
  cancelSupervisorHandover([cancelled], cancelled.id, 'Amina Yusuf', 'Shift supervisor changed at short notice.', now);
  const metrics = supervisorHandoverMetrics([pending, accepted, cancelled]);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.accepted, 1);
  assert.equal(metrics.cancelled, 1);
  assert.equal(metrics.pendingItems, 1);
  assert.equal(metrics.transferredItems, 1);
  assert.equal(metrics.staleItems, 1);
});
