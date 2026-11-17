import test from 'node:test';
import assert from 'node:assert/strict';
import { supervisorQueueBoard } from '../js/supervisor-queue-engine.js';

const base = {
  channel: 'live_chat', channelLabel: 'Live chat', priority: 'high', routeGroup: 'Digital Support',
  receivedAt: '2026-11-17T09:00:00.000Z', timeline: [],
  customerBehaviour: {
    version: '6.64.0', personaId: 'frustrated', personaLabel: 'Frustrated',
    sentiment: 19, patience: 12, mood: 'angry', turns: 2, maxTurns: 3,
    negativeStreak: 2, needsSupervisor: true,
    supervisorReason: 'Customer sentiment is critically low; supervisor intervention is recommended.',
    lastReaction: 'deteriorating', pendingResponse: 'Please get a supervisor.', history: []
  }
};

test('supervisor board exposes open customer-emotion risk separately from first-response SLA', () => {
  const board = supervisorQueueBoard({
    digitalQueue: [{ ...base, id: 'DIG-RISK', customer: 'Amina', subject: 'Unresolved payment', status: 'active' }],
    digitalNow: Date.parse('2026-11-17T09:01:00.000Z')
  });
  assert.equal(board.customerEscalationRecommended, 1);
  assert.equal(board.averageCustomerSentiment, 19);
  assert.equal(board.customerRiskItems.length, 1);
  assert.equal(board.customerRiskItems[0].id, 'DIG-RISK');
  assert.equal(board.customerRiskItems[0].mood, 'angry');
});

test('supervisor board excludes closed conversations from live emotion-risk totals', () => {
  const board = supervisorQueueBoard({ digitalQueue: [{ ...base, id: 'DIG-CLOSED', customer: 'Amina', status: 'resolved' }] });
  assert.equal(board.customerEscalationRecommended, 0);
  assert.equal(board.customerRiskItems.length, 0);
  assert.equal(board.averageCustomerSentiment, null);
});

test('multiple customer-risk records are ranked by lowest sentiment first', () => {
  const board = supervisorQueueBoard({ digitalQueue: [
    { ...base, id: 'DIG-30', customer: 'Thirty', status: 'active', customerBehaviour: { ...base.customerBehaviour, sentiment: 30 } },
    { ...base, id: 'DIG-10', customer: 'Ten', status: 'awaiting_customer', customerBehaviour: { ...base.customerBehaviour, sentiment: 10 } }
  ] });
  assert.deepEqual(board.customerRiskItems.map(item => item.id), ['DIG-10', 'DIG-30']);
  assert.equal(board.customerEscalationRecommended, 2);
});
