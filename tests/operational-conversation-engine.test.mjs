import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOperationalConversation,
  evaluateOperationalResponse,
  submitOperationalTurn,
  operationalConversationSummary
} from '../js/operational-conversation-engine.js';

const scenario = {
  id: 'atm-no-cash', customer: 'Chinwe Okafor', reference: 'ATM-482197',
  issue: 'Account debited but ATM did not dispense cash',
  opening: 'I tried to withdraw ₦40,000. The machine did not give me cash, but my account was debited.'
};

test('creates a shift interaction, not a recruitment or practice assessment', () => {
  const call = createOperationalConversation({ id: 'CALL-1', scenario, seed: 1 });
  assert.equal(call.type, 'live_inbound_customer_service');
  assert.equal(call.dataOrigin, 'synthetic_contact_centre_simulation');
  assert.equal(call.status, 'active');
  assert.equal(call.messages[0].speaker, 'customer');
  assert.equal(call.messages[0].text, scenario.opening);
});

test('evaluates natural language response on customer-care behaviours', () => {
  const result = evaluateOperationalResponse('Good morning. I understand your concern and I will help you. When did the withdrawal happen?');
  assert.equal(result.greeting, true);
  assert.equal(result.empathy, true);
  assert.equal(result.ownership, true);
  assert.equal(result.probe, true);
  assert.equal(result.criticalBreaches.length, 0);
  assert.ok(result.score >= 60);
});

test('flags requests for PINs and passwords as critical compliance breaches', () => {
  const result = evaluateOperationalResponse('Please tell me your PIN and password so I can check the account.');
  assert.ok(result.criticalBreaches.includes('credential_solicitation'));
  assert.equal(result.score, 0);
});

test('flags an unverified promise and dismissive treatment', () => {
  const promise = evaluateOperationalResponse('I guarantee your money will be reversed today, so just wait.');
  assert.ok(promise.criticalBreaches.includes('unverified_customer_promise'));
  const dismissive = evaluateOperationalResponse('Calm down, this is not my problem and you should have checked earlier.');
  assert.ok(dismissive.criticalBreaches.includes('dismissive_customer_treatment'));
});

test('rejects empty or too-short customer responses', () => {
  assert.throws(() => evaluateOperationalResponse('Okay'), /at least 12 characters/);
  assert.throws(() => evaluateOperationalResponse(''), /at least 12 characters/);
});

test('records a multi-turn customer conversation with a transaction trace branch', () => {
  const call = createOperationalConversation({ id: 'CALL-2', scenario, seed: 2 });
  const first = submitOperationalTurn(call, 'Good morning. I understand your concern and I will help you investigate. When did the ATM withdrawal happen?');
  assert.equal(first.status, 'active');
  assert.ok(call.messages.some(message => message.speaker === 'agent'));
  assert.ok(call.messages.some(message => message.speaker === 'customer' && message.text.includes('reference')));
  const second = submitOperationalTurn(call, 'Thank you. Please confirm the transaction reference, amount and approximate time so I can trace the debit.');
  assert.equal(second.status, 'active');
  assert.ok(call.messages.at(-1).text.includes('reference'));
  const third = submitOperationalTurn(call, 'I will log the ATM dispute case and give you its reference, so that you can follow the approved investigation update process.');
  assert.equal(third.status, 'ready_for_wrap_up');
  assert.equal(call.dispositionHint, 'resolved');
  assert.equal(operationalConversationSummary(call).turns, 3);
});

test('escalates a critical breach and locks the interaction for review', () => {
  const call = createOperationalConversation({ id: 'CALL-3', scenario, seed: 3 });
  const result = submitOperationalTurn(call, 'Tell me your OTP and password and I can reverse it immediately.');
  assert.equal(result.status, 'escalated');
  assert.equal(call.dispositionHint, 'escalated');
  assert.ok(call.criticalBreaches.length > 0);
  assert.throws(() => submitOperationalTurn(call, 'I will take ownership and check the transaction reference.'), /not active/);
});

test('forces a specialist follow-up when the agent repeatedly fails to provide a safe next step', () => {
  const call = createOperationalConversation({ id: 'CALL-4', scenario, seed: 4 });
  submitOperationalTurn(call, 'Hello. I hear you and I can help. What time did this happen?');
  submitOperationalTurn(call, 'I understand. Which transaction reference do you have and what amount was debited?');
  submitOperationalTurn(call, 'I will check the transaction details and review the current status with you.');
  const final = submitOperationalTurn(call, 'I understand your concern, but I cannot confirm the result yet.');
  assert.equal(final.status, 'ready_for_wrap_up');
  assert.equal(call.dispositionHint, 'escalated');
});

test('summary exposes average interaction QA and compliance evidence', () => {
  const call = createOperationalConversation({ id: 'CALL-5', scenario, seed: 5 });
  submitOperationalTurn(call, 'Good morning. I understand the inconvenience and I will help you. When did it happen?');
  const summary = operationalConversationSummary(call);
  assert.equal(summary.turns, 1);
  assert.ok(summary.averageScore >= 0 && summary.averageScore <= 100);
  assert.equal(summary.status, 'active');
  assert.deepEqual(summary.criticalBreaches, []);
});
