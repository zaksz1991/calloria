import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_WORKLOAD_VERSION,
  DEFAULT_AGENT_WORKLOAD_POLICY,
  assignedDigitalWorkItems,
  agentWorkloadSnapshot,
  canAcceptDigitalContact,
  canResumeDigitalFollowUp
} from '../js/agent-workload-engine.js';
import { DIGITAL_STATUS } from '../js/multichannel-engine.js';

const AGENT = 'EMP-AB';
function item(id, channel = 'email', status = DIGITAL_STATUS.QUEUED, assignedTo = null) {
  return { id, channel, status, assignedTo, receivedAt: '2026-11-17T08:00:00.000Z', acceptedAt: status === DIGITAL_STATUS.QUEUED ? null : '2026-11-17T08:01:00.000Z' };
}
function allowedOptions(queue, contactId, extra = {}) {
  return {
    queue, contactId, agentId: AGENT, shiftActive: true, inShiftWindow: true,
    agentStatus: 'available', currentCall: null, activeOutbound: null, wrapUp: null,
    ...extra
  };
}

test('v6.62 workload engine publishes the expected version and concurrency policy', () => {
  assert.equal(AGENT_WORKLOAD_VERSION, '6.62.0');
  assert.equal(DEFAULT_AGENT_WORKLOAD_POLICY.maxConcurrentDigital, 3);
  assert.deepEqual(DEFAULT_AGENT_WORKLOAD_POLICY.channelCapacity, { email: 2, live_chat: 2, social: 1 });
});

test('assigned worklist contains only open work assigned to the requested agent', () => {
  const queue = [
    item('a', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('b', 'live_chat', DIGITAL_STATUS.AWAITING_CUSTOMER, AGENT),
    item('c', 'social', DIGITAL_STATUS.ACTIVE, 'EMP-OTHER'),
    item('d', 'social', DIGITAL_STATUS.RESOLVED, AGENT),
    item('e', 'email', DIGITAL_STATUS.QUEUED, null)
  ];
  assert.deepEqual(assignedDigitalWorkItems(queue, AGENT).map(x => x.id), ['a', 'b']);
});

test('awaiting-customer threads remain assigned without consuming an active slot', () => {
  const queue = [
    item('a', 'email', DIGITAL_STATUS.AWAITING_CUSTOMER, AGENT),
    item('b', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT)
  ];
  const snapshot = agentWorkloadSnapshot(queue, AGENT);
  assert.equal(snapshot.assignedCount, 2);
  assert.equal(snapshot.activeCount, 1);
  assert.equal(snapshot.awaitingCustomerCount, 1);
  assert.equal(snapshot.availableSlots, 2);
});

test('empty workload reports all three digital slots available', () => {
  const snapshot = agentWorkloadSnapshot([], AGENT);
  assert.equal(snapshot.availableSlots, 3);
  assert.equal(snapshot.atCapacity, false);
  assert.equal(snapshot.assignedCount, 0);
});

test('an available agent can accept a queued email contact', () => {
  const queue = [item('email-1')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'email-1')).allowed, true);
});

test('an available agent can accept a queued live chat contact', () => {
  const queue = [item('chat-1', 'live_chat')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'chat-1')).allowed, true);
});

test('an available agent can accept a queued social contact', () => {
  const queue = [item('social-1', 'social')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'social-1')).allowed, true);
});

test('an agent can accept a second contact while busy only because of active digital work', () => {
  const queue = [item('active-1', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT), item('queued-2', 'email')];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'queued-2', { agentStatus: 'busy' }));
  assert.equal(result.allowed, true);
  assert.equal(result.workload.activeCount, 1);
});

test('global active digital concurrency is capped at three', () => {
  const queue = [
    item('a', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('b', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT),
    item('c', 'social', DIGITAL_STATUS.ACTIVE, AGENT),
    item('next', 'email')
  ];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'next', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /capacity is full \(3\/3\)/);
});

test('email channel concurrency is capped at two', () => {
  const queue = [
    item('e1', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('e2', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('e3', 'email')
  ];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'e3', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /Email capacity is full/);
});

test('live-chat concurrency is capped at two', () => {
  const queue = [
    item('c1', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT),
    item('c2', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT),
    item('c3', 'live_chat')
  ];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'c3', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /Live chat capacity is full/);
});

test('social concurrency is capped at one', () => {
  const queue = [
    item('s1', 'social', DIGITAL_STATUS.ACTIVE, AGENT),
    item('s2', 'social')
  ];
  const result = canAcceptDigitalContact(allowedOptions(queue, 's2', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /Social media capacity is full/);
});

test('voice interaction blocks digital acceptance', () => {
  const queue = [item('next')];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'next', { currentCall: { id: 'CALL-1' } }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /voice or outbound/);
});

test('outbound interaction blocks digital acceptance', () => {
  const queue = [item('next')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'next', { activeOutbound: { id: 'OUT-1' } })).allowed, false);
});

test('after-contact wrap-up blocks digital acceptance', () => {
  const queue = [item('next')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'next', { wrapUp: { id: 'ACW-1' } })).allowed, false);
});

test('acceptance requires an active shift and scheduled shift window', () => {
  const queue = [item('next')];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'next', { shiftActive: false })).allowed, false);
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'next', { inShiftWindow: false })).allowed, false);
});

test('agent busy for a non-digital reason cannot accept work', () => {
  const queue = [item('next')];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'next', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /agent status is busy/);
});

test('only queued contacts can be newly accepted', () => {
  const queue = [item('already-active', 'email', DIGITAL_STATUS.ACTIVE, AGENT)];
  assert.equal(canAcceptDigitalContact(allowedOptions(queue, 'already-active')).allowed, false);
});

test('unknown channels are refused rather than assigned without a limit', () => {
  const queue = [item('unknown', 'fax')];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'unknown'));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /not supported/);
});

test('awaiting-customer work can resume when capacity is available and ownership matches', () => {
  const queue = [item('waiting', 'live_chat', DIGITAL_STATUS.AWAITING_CUSTOMER, AGENT)];
  const result = canResumeDigitalFollowUp(allowedOptions(queue, 'waiting'));
  assert.equal(result.allowed, true);
});

test('an agent cannot resume another agent customer thread', () => {
  const queue = [item('waiting', 'email', DIGITAL_STATUS.AWAITING_CUSTOMER, 'EMP-OTHER')];
  const result = canResumeDigitalFollowUp(allowedOptions(queue, 'waiting'));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /assigned agent/);
});

test('awaiting-customer thread cannot resume when global slots are full', () => {
  const queue = [
    item('waiting', 'email', DIGITAL_STATUS.AWAITING_CUSTOMER, AGENT),
    item('a', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('b', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT),
    item('c', 'social', DIGITAL_STATUS.ACTIVE, AGENT)
  ];
  const result = canResumeDigitalFollowUp(allowedOptions(queue, 'waiting', { agentStatus: 'busy' }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /capacity is full/);
});

test('workload policy can set zero concurrency to stop all digital assignment', () => {
  const queue = [item('next')];
  const result = canAcceptDigitalContact(allowedOptions(queue, 'next', { policy: { maxConcurrentDigital: 0 } }));
  assert.equal(result.allowed, false);
  assert.match(result.reason, /disabled/);
});

test('snapshot keeps channel counts separate', () => {
  const queue = [
    item('a', 'email', DIGITAL_STATUS.ACTIVE, AGENT),
    item('b', 'email', DIGITAL_STATUS.AWAITING_CUSTOMER, AGENT),
    item('c', 'live_chat', DIGITAL_STATUS.ACTIVE, AGENT),
    item('d', 'social', DIGITAL_STATUS.QUEUED, null)
  ];
  const snapshot = agentWorkloadSnapshot(queue, AGENT);
  assert.deepEqual(snapshot.activeByChannel, { email: 1, live_chat: 1, social: 0 });
  assert.deepEqual(snapshot.assignedByChannel, { email: 2, live_chat: 1, social: 0 });
});
