import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_STATUS, createInboundQueue, sortQueuedContacts, nextQueuedContact,
  transitionContact, countQueuedContacts, queueMetrics, addSuppression,
  isContactSuppressed, scheduleCallback, completeActiveCallback
} from '../js/operations-engine.js';

const scenarios = [
  { id: 'routine', customer: 'Routine Customer', initials: 'RC', category: 'GENERAL SERVICE', issue: 'Balance enquiry' },
  { id: 'suspicious-activity', customer: 'Security Customer', initials: 'SC', category: 'FRAUD SUPPORT', issue: 'Suspicious transaction' },
  { id: 'card-decline', customer: 'Card Customer', initials: 'CC', category: 'CARD SERVICES', issue: 'Card declined' }
];

test('inbound queue creation produces valid unique contact records', () => {
  const queue = createInboundQueue(scenarios, 5, { now: 100000, sequence: 0 });
  assert.equal(queue.length, 5);
  assert.equal(new Set(queue.map(item => item.id)).size, 5);
  assert.ok(queue.every(item => item.status === CONTACT_STATUS.QUEUED));
  assert.ok(queue.some(item => item.priority === 'critical'));
});

test('queue routing prioritises critical contacts before normal contacts', () => {
  const queue = createInboundQueue(scenarios, 3, { now: 200000 });
  const sorted = sortQueuedContacts(queue, 200000);
  assert.equal(sorted[0].priority, 'critical');
  assert.equal(nextQueuedContact(queue, 200000).customer, 'Security Customer');
});

test('contact lifecycle enforces valid transitions and blocks invalid transitions', () => {
  const [contact] = createInboundQueue(scenarios, 1, { now: 300000 });
  transitionContact(contact, CONTACT_STATUS.OFFERED, 'Offered', 300100);
  transitionContact(contact, CONTACT_STATUS.CONNECTED, 'Accepted', 300200);
  transitionContact(contact, CONTACT_STATUS.ON_HOLD, 'Hold', 300300);
  transitionContact(contact, CONTACT_STATUS.CONNECTED, 'Resume', 300400);
  transitionContact(contact, CONTACT_STATUS.WRAP_UP, 'Wrap-up', 300500);
  transitionContact(contact, CONTACT_STATUS.COMPLETED, 'Completed', 300600);
  assert.equal(contact.status, CONTACT_STATUS.COMPLETED);
  assert.equal(contact.timeline.length, 7);
  assert.throws(() => transitionContact(contact, CONTACT_STATUS.QUEUED, 'Invalid requeue', 300700), /Invalid contact transition/);
});

test('queue metrics report wait age and queue count', () => {
  const queue = createInboundQueue(scenarios, 3, { now: 100000 });
  const metrics = queueMetrics(queue, 150000, 60);
  assert.equal(metrics.waiting, 3);
  assert.ok(metrics.longestWaitSeconds >= 60);
  assert.equal(countQueuedContacts(queue), 3);
});

test('outbound suppression blocks repeat campaign contact', () => {
  const suppression = [];
  addSuppression(suppression, 'Grace Customer', 'Customer opted out', 400000);
  addSuppression(suppression, 'grace customer', 'Duplicate suppression', 400100);
  assert.equal(suppression.length, 1);
  assert.equal(isContactSuppressed('GRACE CUSTOMER', suppression), true);
  assert.equal(isContactSuppressed('Other Customer', suppression), false);
});

test('callbacks require a future time and cannot be duplicated while scheduled', () => {
  const [contact] = createInboundQueue(scenarios, 1, { now: 500000 });
  const callbacks = [];
  const future = new Date(600000).toISOString();
  const callback = scheduleCallback(callbacks, contact, future, 500000);
  assert.equal(callback.status, 'scheduled');
  assert.equal(callbacks.length, 1);
  assert.throws(() => scheduleCallback(callbacks, contact, future, 500000), /already exists/);
  assert.throws(() => scheduleCallback([], contact, new Date(400000).toISOString(), 500000), /future/);
});


test('completed inbound callback is closed by contact ID after handling', () => {
  const callbacks = [{ id: 'CBK-IN', contactId: 'CONTACT-1', status: 'in_progress' }];
  const completed = completeActiveCallback(callbacks, { contactId: 'CONTACT-1' }, 700000);
  assert.equal(completed, callbacks[0]);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.completedAt, new Date(700000).toISOString());
});

test('completed outbound callback is closed by callback ID without requiring an inbound contact', () => {
  const callbacks = [
    { id: 'CBK-OLD', contactId: 'OUT-ATTEMPT', type: 'outbound', status: 'in_progress' },
    { id: 'CBK-OTHER', contactId: 'OTHER', type: 'outbound', status: 'in_progress' }
  ];
  const completed = completeActiveCallback(callbacks, { callbackId: 'CBK-OLD' }, 800000);
  assert.equal(completed.id, 'CBK-OLD');
  assert.equal(callbacks[0].status, 'completed');
  assert.equal(callbacks[1].status, 'in_progress');
});

test('callback completion is a no-op when no active callback exists', () => {
  const callbacks = [{ id: 'CBK-1', contactId: 'C-1', status: 'scheduled' }];
  assert.equal(completeActiveCallback(callbacks, { callbackId: 'CBK-1' }, 900000), null);
  assert.equal(callbacks[0].status, 'scheduled');
});
