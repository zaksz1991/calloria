import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue,
  sortDigitalQueue, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp,
  completeDigitalContact, digitalQueueMetrics, appendDigitalEvent
} from '../js/multichannel-engine.js';

const fixedNow = Date.UTC(2026, 10, 7, 8, 0, 0);

function queue(count = 6) {
  return createDigitalQueue(DIGITAL_SCENARIOS, count, { now: fixedNow, sequence: 0 });
}

test('digital channel catalogue defines different response targets', () => {
  assert.deepEqual(Object.keys(DIGITAL_CHANNELS), ['email', 'live_chat', 'social']);
  assert.equal(DIGITAL_CHANNELS.live_chat.slaMinutes, 2);
  assert.ok(DIGITAL_CHANNELS.email.slaMinutes > DIGITAL_CHANNELS.social.slaMinutes);
});

test('queue creation creates bounded synthetic records with channel-specific fields', () => {
  const items = queue(8);
  assert.equal(items.length, 8);
  assert.ok(items.every(item => item.status === DIGITAL_STATUS.QUEUED));
  assert.ok(items.some(item => item.channel === 'email'));
  assert.ok(items.some(item => item.channel === 'live_chat'));
  assert.ok(items.some(item => item.channel === 'social'));
  assert.ok(items.every(item => item.messages[0].type === 'customer'));
});

test('queue prioritisation puts critical social complaints before lower-priority messages', () => {
  const items = queue();
  const sorted = sortDigitalQueue(items, { now: fixedNow });
  assert.equal(sorted[0].priority, 'critical');
  assert.equal(sorted[0].channel, 'social');
  assert.equal(sortDigitalQueue(items, { channel: 'email', now: fixedNow }).length, 2);
});

test('accepting a contact assigns it once and rejects duplicate acceptance', () => {
  const items = queue();
  const item = sortDigitalQueue(items, { now: fixedNow })[0];
  const accepted = acceptDigitalContact(items, item.id, 'EMP-AY', fixedNow + 1000);
  assert.equal(accepted.status, DIGITAL_STATUS.ACTIVE);
  assert.equal(accepted.assignedTo, 'EMP-AY');
  assert.throws(() => acceptDigitalContact(items, item.id, 'EMP-AY', fixedNow + 2000), /Only a queued/);
});

test('reply workflow blocks credential solicitation and full card-number patterns', () => {
  const items = queue();
  const item = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  assert.throws(() => recordDigitalReply(items, item.id, 'Please send your OTP and password so I can help.', 'EMP-AY', fixedNow + 1000), /Unsafe reply blocked/);
  assert.throws(() => recordDigitalReply(items, item.id, 'Please share card number 4111 1111 1111 1111 for review.', 'EMP-AY', fixedNow + 1000), /Unsafe reply blocked/);
  assert.equal(item.replyCount, 0);
});

test('reply workflow validates length, records first response and calculates rule-based QA', () => {
  const items = queue();
  const item = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  assert.throws(() => recordDigitalReply(items, item.id, 'Thanks.', 'EMP-AY', fixedNow + 1000), /at least 12/);
  const result = recordDigitalReply(items, item.id, 'I understand. I will review this case and provide an update with the reference.', 'EMP-AY', fixedNow + 60000);
  assert.equal(result.contact.status, DIGITAL_STATUS.AWAITING_CUSTOMER);
  assert.equal(result.contact.replyCount, 1);
  assert.equal(result.contact.firstResponseAt, new Date(fixedNow + 60000).toISOString());
  assert.ok(result.quality.score >= 75);
});

test('safety disclaimers are not incorrectly treated as credential requests', () => {
  const items = queue();
  const item = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  const result = recordDigitalReply(items, item.id, 'We will never ask you to share your PIN or password. I will review this issue and provide the next step.', 'EMP-AY', fixedNow + 1000);
  assert.equal(result.contact.replyCount, 1);
});

test('public social response requires privacy-safe private-channel direction for full QA', () => {
  const items = queue();
  const social = items.find(item => item.channel === 'social');
  acceptDigitalContact(items, social.id, 'EMP-AY', fixedNow);
  const plain = recordDigitalReply(items, social.id, 'We understand and will review this case and update you soon.', 'EMP-AY', fixedNow + 1000);
  assert.equal(plain.quality.dimensions.privacy, false);
});

test('customer follow-up returns contact to active state exactly once', () => {
  const items = queue();
  const item = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  recordDigitalReply(items, item.id, 'I understand. I will check this and share the next step.', 'EMP-AY', fixedNow + 1000);
  assert.equal(deliverDigitalFollowUp(items, item.id, fixedNow + 2000).status, DIGITAL_STATUS.ACTIVE);
  assert.equal(item.messages.at(-1).type, 'customer');
  assert.throws(() => deliverDigitalFollowUp(items, item.id, fixedNow + 3000), /not awaiting/);
});

test('completion requires an agent response, factual notes and a valid disposition', () => {
  const items = queue();
  const item = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  assert.throws(() => completeDigitalContact(items, item.id, { disposition: 'resolved', notes: 'Insufficient' }, fixedNow + 1000), /at least one agent reply/);
  recordDigitalReply(items, item.id, 'Thank you. I will investigate and provide a case reference.', 'EMP-AY', fixedNow + 1000);
  assert.throws(() => completeDigitalContact(items, item.id, { disposition: 'resolved', notes: 'Too short' }, fixedNow + 2000), /at least 12/);
  const done = completeDigitalContact(items, item.id, { disposition: 'resolved', notes: 'Reviewed the issue and explained the verified next step.' }, fixedNow + 3000);
  assert.equal(done.status, DIGITAL_STATUS.RESOLVED);
  assert.throws(() => completeDigitalContact(items, item.id, { disposition: 'resolved', notes: 'Repeated close attempt' }, fixedNow + 4000), /Only an active/);
});

test('pending and escalated dispositions are separately represented', () => {
  const items = queue();
  const first = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  recordDigitalReply(items, first.id, 'I understand. I will check and update you with the next step.', 'EMP-AY', fixedNow + 1000);
  completeDigitalContact(items, first.id, { disposition: 'pending_customer', notes: 'Awaiting permitted customer information.' }, fixedNow + 2000);
  const second = acceptDigitalContact(items, items[1].id, 'EMP-AY', fixedNow + 3000);
  recordDigitalReply(items, second.id, 'I appreciate the details. I will route this to the specialist team.', 'EMP-AY', fixedNow + 4000);
  completeDigitalContact(items, second.id, { disposition: 'escalated', notes: 'Specialist investigation required; case routed.' }, fixedNow + 5000);
  assert.equal(first.status, DIGITAL_STATUS.PENDING_CUSTOMER);
  assert.equal(second.status, DIGITAL_STATUS.ESCALATED);
});

test('metrics report workload by channel, response time, QA and SLA risk', () => {
  const items = queue();
  const metrics = digitalQueueMetrics(items, fixedNow + 10 * 60 * 1000);
  assert.equal(metrics.waiting, 6);
  assert.equal(metrics.slaAtRisk, 2);
  assert.equal(metrics.channelCounts.email.waiting, 2);
  assert.equal(metrics.channelCounts.live_chat.waiting, 2);
  assert.equal(metrics.channelCounts.social.waiting, 2);
  const contact = acceptDigitalContact(items, items[0].id, 'EMP-AY', fixedNow);
  recordDigitalReply(items, contact.id, 'I understand. I will review and update you with the reference.', 'EMP-AY', fixedNow + 60000);
  const updated = digitalQueueMetrics(items, fixedNow + 120000);
  assert.equal(updated.averageFirstResponseMinutes, 5.5); // includes queue age before the agent's first reply
  assert.ok(updated.averageQA >= 0);
});

test('digital event history is bounded and records channel context', () => {
  const events = [];
  const event = appendDigitalEvent(events, { contactId: 'DIG-1', channel: 'email', type: 'reply', message: 'Reply recorded', status: 'sent' }, fixedNow);
  assert.equal(event.channel, 'email');
  assert.equal(events.length, 1);
});


test('social-channel privacy check changes after the customer moves to private support', () => {
  const items = queue();
  const social = items.find(item => item.channel === 'social');
  acceptDigitalContact(items, social.id, 'EMP-AY', fixedNow);
  const publicReply = recordDigitalReply(items, social.id, 'We understand and will review the case and send an update with the next step.', 'EMP-AY', fixedNow + 1000);
  assert.equal(publicReply.quality.dimensions.privacy, false);
  deliverDigitalFollowUp(items, social.id, fixedNow + 2000);
  const privateReply = recordDigitalReply(items, social.id, 'Thank you for moving to the verified message. I will investigate and provide the case update.', 'EMP-AY', fixedNow + 3000);
  assert.equal(privateReply.quality.dimensions.privacy, true);
});
