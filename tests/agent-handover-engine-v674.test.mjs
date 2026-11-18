import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_HANDOVER_VERSION,
  normalizeAgentHandovers,
  collectAgentHandoverCandidates,
  createAgentShiftHandover,
  acceptAgentShiftHandover,
  cancelAgentShiftHandover,
  agentShiftHandoverMetrics
} from '../js/agent-handover-engine.js';

const now = new Date('2026-11-18T20:00:00.000Z');
const note = 'Customer still needs a verified update; checks already completed are noted and the next agent must confirm the agreed follow-up.';

function resourcesFixture() {
  return {
    digitalQueue: [
      { id: 'DIG-OPEN-1', status: 'active', assignedTo: 'EMP-AY', customer: 'Ada Example', subject: 'Card dispute update', channel: 'email', channelLabel: 'Email', priority: 'high', timeline: [] },
      { id: 'DIG-WAIT-1', status: 'queued', assignedTo: 'EMP-AY', customer: 'Queued Example', subject: 'Queued work', channel: 'email', timeline: [] },
      { id: 'DIG-OTHER-1', status: 'active', assignedTo: 'EMP-BM', customer: 'Other Example', subject: 'Other agent work', channel: 'live_chat', timeline: [] }
    ],
    commitments: [
      { id: 'CB-OPEN-1', status: 'Open', owner: 'Amina Yusuf', customerName: 'Bola Example', caseId: 'CASE-CB-1', contactReference: 'CALL-1', commitment: 'Confirm the investigation result', dueDate: '2026-11-19', dueMinutes: 540, history: [] },
      { id: 'CB-COMPLETE', status: 'Complete', owner: 'Amina Yusuf', customerName: 'Closed Example', commitment: 'Already completed', history: [] },
      { id: 'CB-REVIEW', status: 'Needs review', owner: 'Amina Yusuf', customerName: 'Review Example', commitment: 'Waiting for supervisor', history: [] },
      { id: 'CB-OTHER', status: 'Open', owner: 'Bello Musa', customerName: 'Other Owner', commitment: 'Not owned by Amina', history: [] }
    ],
    commitmentState: { commitments: [], activity: [] },
    cases: [
      {
        reference: 'CASE-FOLLOWUP', customer: 'Chika Example', title: 'Incorrect service outcome', channel: 'Voice', status: 'Reopened · follow-up due', owner: 'Previous Case Owner',
        lifecycle: { followUp: { id: 'CFU-1', status: 'in_progress', owner: 'Amina Yusuf', claimedBy: 'Amina Yusuf', claimedAt: '2026-11-18T19:00:00.000Z', dueDay: 4, dueMinute: 600, history: [] }, history: [] }
      },
      {
        reference: 'CASE-OPEN', customer: 'Dayo Example', title: 'Awaiting final investigation update', channel: 'Email', status: 'Pending customer', owner: 'Amina Yusuf', lifecycle: { followUp: null, history: [] }
      },
      {
        reference: 'CASE-SUPERVISOR', customer: 'Efe Example', title: 'Independent review', channel: 'Voice', status: 'Reopened · follow-up due', owner: 'Amina Yusuf',
        lifecycle: { followUp: { id: 'CFU-2', status: 'supervisor_review', owner: 'Amina Yusuf', claimedBy: '', history: [] }, history: [] }
      },
      {
        reference: 'CASE-CLOSED', customer: 'Closed Case', title: 'Closed case', channel: 'Voice', status: 'Resolved', owner: 'Amina Yusuf', lifecycle: { followUp: null, history: [] }
      }
    ],
    callbacks: [
      { id: 'CALLBACK-1', status: 'scheduled', commitmentId: 'CB-OPEN-1' },
      { id: 'CALLBACK-2', status: 'completed', commitmentId: 'CB-OPEN-1' }
    ]
  };
}

function createOne(resources = resourcesFixture(), handovers = []) {
  const handover = createAgentShiftHandover(resources, handovers, {
    fromAgent: 'Amina Yusuf', fromAgentId: 'EMP-AY',
    toAgent: 'Bello Musa', toAgentId: 'EMP-BM', note
  }, now);
  return { handover, resources, handovers };
}

test('normalisation preserves v6.74 handover fields and canonicalises legacy item status', () => {
  const result = normalizeAgentHandovers([{
    id: 'AGH-OLD', fromAgent: 'Amina Yusuf', toAgent: 'Bello Musa',
    fromAgentId: 'EMP-AY', toAgentId: 'EMP-BM', note, status: 'unknown', createdAt: now.toISOString(),
    items: [{ type: 'customer_commitment', itemId: 'CB-OLD', status: 'unknown' }]
  }], now);
  assert.equal(result[0].version, AGENT_HANDOVER_VERSION);
  assert.equal(result[0].status, 'pending_acceptance');
  assert.equal(result[0].items[0].status, 'pending');
  assert.equal(result[0].items[0].originalOwner, 'Amina Yusuf');
});

test('candidate collection includes only work owned by the outgoing agent and still active', () => {
  const resources = resourcesFixture();
  const rows = collectAgentHandoverCandidates(resources, 'Amina Yusuf', 'EMP-AY', []);
  assert.deepEqual(rows.map(item => `${item.type}:${item.itemId}`).sort(), [
    'case_followup:CASE-FOLLOWUP',
    'customer_commitment:CB-OPEN-1',
    'digital_contact:DIG-OPEN-1',
    'open_case:CASE-OPEN'
  ].sort());
  assert.deepEqual(rows.find(item => item.itemId === 'CB-OPEN-1').callbackIds, ['CALLBACK-1']);
});

test('pending handover reserves each item so it cannot be placed in a second pending handover', () => {
  const { handover, resources, handovers } = createOne();
  assert.equal(handover.status, 'pending_acceptance');
  const next = collectAgentHandoverCandidates(resources, 'Amina Yusuf', 'EMP-AY', handovers);
  assert.equal(next.length, 0);
});

test('creation requires distinct agents, a valid employee reference, meaningful note and eligible work', () => {
  const resources = resourcesFixture();
  const base = { fromAgent: 'Amina Yusuf', fromAgentId: 'EMP-AY', toAgent: 'Bello Musa', toAgentId: 'EMP-BM', note };
  assert.throws(() => createAgentShiftHandover(resources, [], { ...base, toAgent: 'Amina Yusuf' }, now), /different from the outgoing/i);
  assert.throws(() => createAgentShiftHandover(resources, [], { ...base, toAgentId: 'EMP-AY' }, now), /different from the outgoing/i);
  assert.throws(() => createAgentShiftHandover(resources, [], { ...base, note: 'Too short' }, now), /30 characters/);
  assert.throws(() => createAgentShiftHandover(resources, [], { ...base, toAgentId: '' }, now), /employee reference/);
  const none = { digitalQueue: [], commitments: [], cases: [], callbacks: [] };
  assert.throws(() => createAgentShiftHandover(none, [], base, now), /no eligible open work/i);
});

test('preparing handover records item snapshots but leaves every current owner unchanged', () => {
  const resources = resourcesFixture();
  const { handover } = createOne(resources);
  assert.equal(handover.items.length, 4);
  assert.equal(resources.digitalQueue[0].assignedTo, 'EMP-AY');
  assert.equal(resources.commitments[0].owner, 'Amina Yusuf');
  assert.equal(resources.cases[0].owner, 'Previous Case Owner');
  assert.equal(resources.cases[1].owner, 'Amina Yusuf');
});

test('only the named incoming agent with the expected employee reference can accept', () => {
  const { handover, resources, handovers } = createOne();
  assert.throws(() => acceptAgentShiftHandover(resources, handovers, handover.id, 'Amina Yusuf', 'EMP-AY', now), /Only the named incoming agent/);
  assert.throws(() => acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-WRONG', now), /Only the named incoming agent/);
  assert.equal(handover.status, 'pending_acceptance');
});

test('acceptance transfers digital contacts and retains the existing transcript timeline', () => {
  const { handover, resources, handovers } = createOne();
  resources.digitalQueue[0].timeline.push({ at: now.toISOString(), event: 'Prior contact response', status: 'awaiting_customer' });
  const result = acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', new Date('2026-11-18T20:05:00.000Z'));
  assert.equal(result.transferred, 4);
  assert.equal(result.stale, 0);
  assert.equal(resources.digitalQueue[0].assignedTo, 'EMP-BM');
  assert.equal(resources.digitalQueue[0].assignedAgentName, 'Bello Musa');
  assert.equal(resources.digitalQueue[0].timeline.some(item => /handover accepted/i.test(item.event)), true);
  assert.equal(handover.status, 'accepted');
  assert.equal(handover.acceptedBy, 'Bello Musa');
});

test('acceptance transfers open promises while preserving due plans and callback task linkage', () => {
  const { handover, resources, handovers } = createOne();
  const beforeDue = [resources.commitments[0].dueDate, resources.commitments[0].dueMinutes];
  const result = acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', now);
  assert.equal(result.transferred, 4);
  assert.equal(resources.commitments[0].owner, 'Bello Musa');
  assert.deepEqual([resources.commitments[0].dueDate, resources.commitments[0].dueMinutes], beforeDue);
  assert.equal(resources.commitments[0].history[0].outcome, 'agent-shift-handover');
  assert.equal(resources.callbacks[0].status, 'scheduled');
  assert.equal(resources.callbacks[0].commitmentId, 'CB-OPEN-1');
  assert.equal(resources.commitmentState.activity.length, 1);
});

test('case follow-up ownership transfers and old agent claim is released for explicit incoming claim', () => {
  const { handover, resources, handovers } = createOne();
  const oldDue = [resources.cases[0].lifecycle.followUp.dueDay, resources.cases[0].lifecycle.followUp.dueMinute];
  acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', now);
  const followUp = resources.cases[0].lifecycle.followUp;
  assert.equal(resources.cases[0].owner, 'Bello Musa');
  assert.equal(followUp.owner, 'Bello Musa');
  assert.equal(followUp.status, 'open');
  assert.equal(followUp.claimedBy, '');
  assert.equal(followUp.claimedAt, null);
  assert.deepEqual([followUp.dueDay, followUp.dueMinute], oldDue);
  assert.equal(followUp.history[0].action, 'agent_shift_handover');
});

test('open CRM case ownership transfers without replacing the case notes or customer history', () => {
  const { handover, resources, handovers } = createOne();
  const record = resources.cases[1];
  record.notes = 'Merchant reference checked; customer update remains due.';
  record.messages = [{ type: 'customer', text: 'Please update me.' }];
  acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', now);
  assert.equal(record.owner, 'Bello Musa');
  assert.equal(record.notes, 'Merchant reference checked; customer update remains due.');
  assert.equal(record.messages.length, 1);
  assert.equal(record.lifecycle.history[0].action, 'case_handover');
});

test('closed, completed or reassigned items are marked stale and skipped at acceptance', () => {
  const { handover, resources, handovers } = createOne();
  resources.digitalQueue[0].status = 'resolved';
  resources.commitments[0].owner = 'Other Agent';
  resources.cases[0].lifecycle.followUp.status = 'complete';
  resources.cases[1].status = 'Resolved';
  const result = acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', now);
  assert.equal(result.transferred, 0);
  assert.equal(result.stale, 4);
  assert.ok(handover.items.every(item => item.status === 'stale'));
  assert.ok(handover.items.every(item => item.staleReason.length > 0));
});

test('only outgoing agent can cancel pending handover and cancellation leaves owners unchanged', () => {
  const { handover, resources, handovers } = createOne();
  assert.throws(() => cancelAgentShiftHandover(handovers, handover.id, 'Bello Musa', 'No longer needed for operations.', now), /Only the outgoing agent/);
  assert.throws(() => cancelAgentShiftHandover(handovers, handover.id, 'Amina Yusuf', 'Short', now), /10 characters/);
  const cancelled = cancelAgentShiftHandover(handovers, handover.id, 'Amina Yusuf', 'The incoming agent is unavailable for this scheduled shift.', now);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(resources.digitalQueue[0].assignedTo, 'EMP-AY');
  assert.equal(resources.commitments[0].owner, 'Amina Yusuf');
  assert.equal(resources.cases[0].owner, 'Previous Case Owner');
});

test('metrics report pending, accepted, cancelled, transferred and stale workloads', () => {
  const resources = resourcesFixture();
  const { handover, handovers } = createOne(resources);
  const before = agentShiftHandoverMetrics(handovers);
  assert.equal(before.pending, 1);
  assert.equal(before.pendingItems, 4);
  acceptAgentShiftHandover(resources, handovers, handover.id, 'Bello Musa', 'EMP-BM', now);
  const after = agentShiftHandoverMetrics(handovers);
  assert.equal(after.accepted, 1);
  assert.equal(after.transferredItems, 4);
  assert.equal(after.pendingItems, 0);
  assert.equal(after.staleItems, 0);
});
