import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITAL_CUSTOMER_BEHAVIOUR_VERSION,
  ensureDigitalCustomerBehaviour,
  evaluateDigitalCustomerReaction,
  deliverAdaptiveDigitalCustomerResponse,
  digitalCustomerBehaviourSnapshot,
  digitalCustomerBehaviourMetrics,
  digitalCustomerBehaviourRiskItems
} from '../js/digital-customer-behaviour-engine.js';

function contact(id = 'DIG-TEST-001', extra = {}) {
  return {
    id, customer: 'Amina Bello', subject: 'Payment has not arrived', channel: 'email', channelLabel: 'Email',
    priority: 'normal', status: 'active', replyCount: 0, followUpDelivered: false,
    followUp: 'Please confirm the next step.', messages: [], timeline: [], ...extra
  };
}

function setPersona(item, personaId, state = {}) {
  item.customerBehaviour = {
    version: DIGITAL_CUSTOMER_BEHAVIOUR_VERSION,
    personaId, personaLabel: personaId, sentiment: 50, patience: 50, mood: 'concerned',
    turns: 0, maxTurns: 3, negativeStreak: 0, needsSupervisor: false,
    supervisorReason: '', lastReaction: 'initial', pendingResponse: '', history: [], exhausted: false,
    ...state
  };
}

const goodReply = 'I understand your concern and I will take ownership. I will review the case reference and trace the payment. The next step is to send you an update within one working day.';
const goodQuality = { dimensions: { acknowledgement: true, ownership: true, nextStep: true, privacy: true } };
const poorQuality = { dimensions: { acknowledgement: false, ownership: false, nextStep: false, privacy: true } };

test('customer behaviour is seeded once with a deterministic persona for each contact', () => {
  const item = contact('DIG-STABLE-77');
  const first = ensureDigitalCustomerBehaviour(item);
  const persona = first.personaId;
  const second = ensureDigitalCustomerBehaviour(item);
  assert.deepEqual(second, first);
  assert.equal(second.personaId, persona);
  assert.ok(second.sentiment >= 0 && second.sentiment <= 100);
  assert.ok(second.patience >= 0 && second.patience <= 100);
  assert.equal(second.maxTurns, 3);
});

test('positive agent language improves customer sentiment and prepares a relevant next response', () => {
  const item = contact();
  setPersona(item, 'cooperative', { sentiment: 40, patience: 40, mood: 'concerned' });
  const result = evaluateDigitalCustomerReaction(item, goodQuality, goodReply, 1_800_000_000_000);
  assert.equal(result.event.reaction, 'improving');
  assert.ok(result.behaviour.sentiment > 40);
  assert.ok(result.behaviour.patience > 40);
  assert.ok(result.pendingResponse.length > 20);
  assert.equal(result.behaviour.needsSupervisor, false);
  assert.equal(item.timeline.at(-1).status, 'customer_reaction');
});

test('poor acknowledgement, ownership and next-step handling deteriorate sentiment', () => {
  const item = contact();
  setPersona(item, 'frustrated', { sentiment: 60, patience: 60, mood: 'calm' });
  const result = evaluateDigitalCustomerReaction(item, poorQuality, 'We will look into it later.', 1_800_000_000_000);
  assert.equal(result.event.reaction, 'deteriorating');
  assert.ok(result.behaviour.sentiment < 60);
  assert.ok(result.behaviour.patience < 60);
  assert.match(result.pendingResponse, /acknowledged|explained/i);
});

test('repeat dissatisfied responses trigger a supervisor recommendation', () => {
  const item = contact();
  setPersona(item, 'repeat_complainant', { sentiment: 55, patience: 55, mood: 'calm' });
  evaluateDigitalCustomerReaction(item, poorQuality, 'Please wait while I check.', 1_800_000_000_000);
  const result = evaluateDigitalCustomerReaction(item, poorQuality, 'We cannot help with this today.', 1_800_000_060_000);
  assert.equal(result.behaviour.needsSupervisor, true);
  assert.match(result.behaviour.supervisorReason, /sentiment|repeated/i);
  assert.ok(result.behaviour.sentiment <= 28 || result.behaviour.negativeStreak >= 2);
});

test('security-conscious customer requests the approved secure process when the reply lacks reassurance', () => {
  const item = contact('DIG-SECURE', { priority: 'critical' });
  setPersona(item, 'security_cautious', { sentiment: 50, patience: 55, mood: 'concerned' });
  const result = evaluateDigitalCustomerReaction(item, goodQuality, 'I understand and will investigate the issue. The next step is to review the case and send an update tomorrow.', 1_800_000_000_000);
  assert.match(result.pendingResponse, /official secure route|secure process/i);
});

test('time-pressured customer reacts to a specific update window', () => {
  const item = contact('DIG-TIME');
  setPersona(item, 'time_pressured', { sentiment: 48, patience: 30, mood: 'concerned' });
  const result = evaluateDigitalCustomerReaction(item, goodQuality, goodReply, 1_800_000_000_000);
  assert.ok(result.behaviour.sentiment >= 48);
  assert.ok(result.behaviour.patience >= 30);
  assert.match(result.pendingResponse, /time|update|reference/i);
});

test('adaptive customer response is delivered once and returns the thread to active agent work', () => {
  const item = contact();
  setPersona(item, 'cooperative', { pendingResponse: 'Thank you. Please confirm the reference and next update.' });
  item.status = 'awaiting_customer';
  const result = deliverAdaptiveDigitalCustomerResponse(item, 1_800_000_000_000);
  assert.equal(result.response.type, 'customer');
  assert.equal(item.status, 'active');
  assert.equal(item.customerBehaviour.turns, 1);
  assert.equal(item.customerBehaviour.pendingResponse, '');
  assert.equal(item.followUpDelivered, true);
  assert.throws(() => deliverAdaptiveDigitalCustomerResponse(item, 1_800_000_060_000), /not waiting/i);
});

test('adaptive response rejects a waiting thread with no prepared customer turn', () => {
  const item = contact('DIG-NO-TURN', { status: 'awaiting_customer' });
  setPersona(item, 'cooperative');
  assert.throws(() => deliverAdaptiveDigitalCustomerResponse(item), /no further simulated customer response/i);
});

test('legacy awaiting-customer records migrate their saved follow-up into the pending response', () => {
  const item = contact('DIG-LEGACY', { status: 'awaiting_customer', followUp: 'I can provide the transaction reference securely.', followUpDelivered: false });
  const behaviour = ensureDigitalCustomerBehaviour(item);
  assert.equal(behaviour.pendingResponse, item.followUp);
  assert.equal(digitalCustomerBehaviourSnapshot(item).hasPendingResponse, true);
});

test('customer conversation stops generating further turns at the configured maximum', () => {
  const item = contact('DIG-LIMIT');
  setPersona(item, 'cooperative', { turns: 3, maxTurns: 3, sentiment: 75, patience: 80 });
  const result = evaluateDigitalCustomerReaction(item, goodQuality, goodReply, 1_800_000_000_000);
  assert.equal(result.pendingResponse, '');
  assert.equal(result.behaviour.exhausted, true);
});

test('customer behaviour metrics count open intervention risks and rank them by sentiment', () => {
  const high = contact('DIG-HIGH', { status: 'active' });
  setPersona(high, 'frustrated', { sentiment: 18, needsSupervisor: true, supervisorReason: 'Customer sentiment is critically low.' });
  const moderate = contact('DIG-MOD', { status: 'awaiting_customer' });
  setPersona(moderate, 'repeat_complainant', { sentiment: 25, needsSupervisor: true, supervisorReason: 'Repeated dissatisfaction.' });
  const resolved = contact('DIG-CLOSED', { status: 'resolved' });
  setPersona(resolved, 'frustrated', { sentiment: 10, needsSupervisor: true });
  const metrics = digitalCustomerBehaviourMetrics([high, moderate, resolved]);
  assert.equal(metrics.supervisorRecommended, 2);
  assert.equal(metrics.averageOpenSentiment, 22);
  assert.deepEqual(digitalCustomerBehaviourRiskItems([high, moderate, resolved]).map(row => row.contact.id), ['DIG-HIGH', 'DIG-MOD']);
  assert.equal(metrics.riskItems[0].id, 'DIG-HIGH');
});
