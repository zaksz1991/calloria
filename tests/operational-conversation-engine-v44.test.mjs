import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOperationalConversation,
  evaluateOperationalResponse,
  submitOperationalTurn,
  operationalConversationSummary
} from '../js/operational-conversation-engine.js';

const scenario = {
  id: 'tel-data-441', category: 'TELECOMMUNICATIONS · DATA SUPPORT',
  customer: 'Kehinde Balogun', reference: 'TEL-731904',
  issue: 'Purchased data bundle is active but mobile data is unavailable',
  opening: 'I bought a data bundle this morning. I received a confirmation message, but I still cannot browse.'
};

test('creates a production-mode synthetic contact, separate from recruitment and OJT', () => {
  const call = createOperationalConversation({ id: 'IN-001', scenario, seed: 1 });
  assert.equal(call.type, 'live_inbound_customer_service');
  assert.equal(call.dataOrigin, 'synthetic_contact_centre_simulation');
  assert.equal(call.industry, scenario.category);
  assert.equal(call.status, 'active');
  assert.equal(call.messages[0].speaker, 'customer');
  assert.equal(call.messages[0].text, scenario.opening);
});

test('supports non-banking contact reasons and industry-neutral references', () => {
  const call = createOperationalConversation({ id: 'IN-002', scenario, seed: 2 });
  assert.equal(call.reference, 'TEL-731904');
  assert.match(call.issue, /data bundle/i);
  assert.doesNotMatch(call.issue, /bank|account|ATM|transfer/i);
});

test('evaluates natural language for greeting, empathy, ownership and investigation', () => {
  const result = evaluateOperationalResponse('Good morning. I understand the inconvenience and I will check the service record with you. When did the data bundle stop working?');
  assert.equal(result.greeting, true);
  assert.equal(result.empathy, true);
  assert.equal(result.ownership, true);
  assert.equal(result.probe, true);
  assert.equal(result.criticalBreaches.length, 0);
  assert.ok(result.score >= 75);
});

test('rejects responses too short to constitute a customer-care turn', () => {
  assert.throws(() => evaluateOperationalResponse('Okay'), /at least 12 characters/);
  assert.throws(() => evaluateOperationalResponse(''), /at least 12 characters/);
});

test('flags credential solicitation and locks the live conversation for review', () => {
  const call = createOperationalConversation({ id: 'IN-003', scenario, seed: 3 });
  const result = submitOperationalTurn(call, 'Please tell me your PIN and password so I can check the service account.');
  assert.equal(result.status, 'escalated');
  assert.equal(call.dispositionHint, 'escalated');
  assert.ok(call.criticalBreaches.includes('credential_solicitation'));
  assert.throws(() => submitOperationalTurn(call, 'I will take ownership and check the service record.'), /not active/);
});

test('flags false promises and dismissive customer treatment', () => {
  const promise = evaluateOperationalResponse('I guarantee the service will be fixed today and you can be 100% sure.');
  assert.ok(promise.criticalBreaches.includes('unverified_customer_promise'));
  const dismissive = evaluateOperationalResponse('Calm down, this is not my problem and you should have checked earlier.');
  assert.ok(dismissive.criticalBreaches.includes('dismissive_customer_treatment'));
});

test('records a multi-turn conversation and reaches a truthful wrap-up state', () => {
  const call = createOperationalConversation({ id: 'IN-004', scenario, seed: 4 });
  const first = submitOperationalTurn(call, 'Good morning. I understand the inconvenience and I will investigate this with you. When did the service stop working?');
  assert.equal(first.status, 'active');
  assert.ok(call.messages.some(message => message.speaker === 'agent'));
  assert.ok(call.messages.some(message => message.speaker === 'customer' && message.text.includes('reference')));
  submitOperationalTurn(call, 'The reference is TEL-731904. I purchased the bundle this morning, and the confirmation message is visible on my phone.');
  const third = submitOperationalTurn(call, 'I have checked the record. I will raise a provisioning ticket and explain the next update, so that you know who owns the follow-up.');
  assert.equal(third.status, 'ready_for_wrap_up');
  assert.equal(call.dispositionHint, 'resolved');
  assert.equal(operationalConversationSummary(call).turns, 3);
});

test('forces specialist follow-up if the customer-care outcome is still unclear', () => {
  const call = createOperationalConversation({ id: 'IN-005', scenario, seed: 0 });
  submitOperationalTurn(call, 'Hello. I hear you and I can help. What time did this happen?');
  submitOperationalTurn(call, 'I understand. Which service reference do you have and when did the issue start?');
  submitOperationalTurn(call, 'I will review the service record and check the current status with you.');
  const final = submitOperationalTurn(call, 'I appreciate your patience. I cannot confirm the result yet, so the next step is still under review.');
  assert.equal(final.status, 'ready_for_wrap_up');
  assert.equal(call.dispositionHint, 'escalated');
});

test('summary exposes QA, compliance evidence and customer-care coaching', () => {
  const call = createOperationalConversation({ id: 'IN-006', scenario, seed: 0 });
  submitOperationalTurn(call, 'Good morning. I understand the inconvenience and I will help you. When did the service issue begin?');
  const summary = operationalConversationSummary(call);
  assert.equal(summary.turns, 1);
  assert.ok(summary.averageScore >= 0 && summary.averageScore <= 100);
  assert.equal(summary.status, 'active');
  assert.deepEqual(summary.criticalBreaches, []);
  assert.ok(Array.isArray(summary.recommendations));
});

test('conversation can be persisted and reloaded without losing dialogue history', () => {
  const call = createOperationalConversation({ id: 'IN-007', scenario, seed: 1 });
  submitOperationalTurn(call, 'Good morning. I understand the problem and I will check the service reference. When did this begin?');
  const restored = JSON.parse(JSON.stringify(call));
  assert.equal(restored.messages.length, call.messages.length);
  assert.equal(restored.messages[1].speaker, 'agent');
  assert.equal(operationalConversationSummary(restored).turns, 1);
});
