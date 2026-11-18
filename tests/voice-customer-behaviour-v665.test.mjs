import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_CUSTOMER_BEHAVIOUR_VERSION,
  VOICE_CUSTOMER_BEHAVIOUR_POLICY,
  ensureVoiceCustomerBehaviour,
  evaluateVoiceCustomerTurn,
  evaluateVoiceAgentUtterance,
  resolveVoiceCustomerDecision,
  voiceCustomerBehaviourSnapshot,
  voiceCustomerOutcome,
  sanitizeVoiceCustomerText
} from '../js/voice-customer-behaviour-engine.js';

const scenario = (extra = {}) => ({
  id: 'atm-no-cash', category: 'BANKING · ATM DISPUTE',
  opening: 'I was debited but the ATM did not dispense cash.',
  issue: 'Account debit dispute', ...extra
});
const customer = (id = 'VOICE-TEST-001', extra = {}) => ({
  id, customer: 'Chinwe Okafor', issue: 'Account debit dispute', status: 'connected', ...extra
});
const callFor = (id = 'VOICE-CALL-001') => ({ scenarioId: 'atm-no-cash', queueContactId: id, stepIndex: 0 });
const strongResponse = 'I understand why this is concerning. I will take ownership and review the transaction reference through the approved secure verification process. I will log the case and explain the next step and expected update once confirmed.';

test('creates a stable customer persona and opening transcript for an accepted call', () => {
  const contact = customer();
  const call = callFor(contact.id);
  const first = ensureVoiceCustomerBehaviour(call, contact, scenario(), 1_800_000_000_000);
  const second = ensureVoiceCustomerBehaviour(call, contact, scenario(), 1_800_000_001_000);
  assert.deepEqual(first, second);
  assert.equal(first.version, VOICE_CUSTOMER_BEHAVIOUR_VERSION);
  assert.equal(first.transcript[0].speaker, 'customer');
  assert.match(first.transcript[0].text, /ATM did not dispense cash/i);
  const snapshot = voiceCustomerBehaviourSnapshot(first);
  assert.equal(snapshot.interruptionCount, 0);
  assert.equal(snapshot.negotiationCount, 0);
  assert.ok(snapshot.sentiment >= 0 && snapshot.sentiment <= 100);
  assert.ok(snapshot.patience >= 0 && snapshot.patience <= 100);
});

test('empathetic, secure scripted handling improves sentiment and patience', () => {
  const contact = customer('VOICE-GOOD');
  const call = callFor(contact.id);
  const before = ensureVoiceCustomerBehaviour(call, contact, scenario()).sentiment;
  const result = evaluateVoiceCustomerTurn(call.voiceBehaviour, { text: strongResponse, score: 2 }, { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 });
  assert.ok(result.behaviour.sentiment > before);
  assert.ok(result.behaviour.patience > 43);
  assert.equal(result.dimensions.acknowledgement, true);
  assert.equal(result.dimensions.ownership, true);
  assert.equal(result.dimensions.secure, true);
  assert.equal(result.dimensions.nextStep, true);
  assert.equal(result.needsSupervisor, false);
  assert.equal(result.behaviour.transcript.at(-2).speaker, 'agent');
  assert.equal(result.behaviour.transcript.at(-1).speaker, 'customer');
  assert.equal(result.event.turn, 1);
});

test('dismissive free-form handling triggers a customer interruption decision', () => {
  const contact = customer('VOICE-INTERRUPT', { issue: 'Repeated complaint still unresolved' });
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario({ issue: 'Repeated complaint still unresolved' }));
  behaviour.sentiment = 35;
  behaviour.patience = 20;
  const result = evaluateVoiceAgentUtterance(behaviour, 'I cannot help unless you calm down. Just wait.', { scenario: scenario(), stepIndex: 1, now: 1_800_000_000_000 });
  assert.equal(result.decision.type, 'interruption');
  assert.equal(result.behaviour.interruptionCount, 1);
  assert.match(result.customerMessage, /let me finish|take ownership/i);
  const resolved = resolveVoiceCustomerDecision(behaviour, 'listen', { now: 1_800_000_001_000 });
  assert.equal(resolved.option.id, 'listen');
  assert.equal(resolved.event.type, 'customer_interruption_resolved');
  assert.equal(resolved.behaviour.pendingDecision, null);
  assert.ok(resolved.scoreDelta > 0);
});

test('secure warnings against sharing PINs or passwords are not misclassified as credential requests', () => {
  const contact = customer('VOICE-SECURE-WARNING');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const result = evaluateVoiceAgentUtterance(behaviour, 'For your protection, I will not ask for your PIN or password. Never share a one-time code with anyone. I will use the approved secure verification process and explain the next step.', { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 });
  assert.equal(result.criticalBreach, false);
  assert.equal(result.behaviour.needsSupervisor, false);
  assert.equal(result.behaviour.qualityFlags.includes('prohibited_secret_request'), false);
  assert.equal(result.dimensions.secure, true);
});

test('a mixed refusal and a separate credential request still triggers a critical breach', () => {
  const contact = customer('VOICE-MIXED-REQUEST');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const result = evaluateVoiceAgentUtterance(behaviour, 'You do not need to share your PIN, but please tell me the PIN so I can verify you.', { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 });
  assert.equal(result.criticalBreach, true);
  assert.ok(result.behaviour.qualityFlags.includes('prohibited_secret_request'));
});

test('prohibited requests for PINs and one-time codes create critical security risk', () => {
  const contact = customer('VOICE-SECURITY');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const result = evaluateVoiceAgentUtterance(behaviour, 'Please read your PIN and one-time password to me so I can verify you.', { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 });
  assert.equal(result.criticalBreach, true);
  assert.equal(result.behaviour.needsSupervisor, true);
  assert.ok(result.behaviour.qualityFlags.includes('prohibited_secret_request'));
  assert.match(behaviour.supervisorReason, /prohibited request/i);
  assert.match(result.customerMessage, /will not share/i);
  assert.ok(result.behaviour.sentiment < 30);
});

test('service-recovery negotiation stays under review until the agent checks authority', () => {
  const contact = customer('VOICE-NEGOTIATION');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const first = evaluateVoiceAgentUtterance(behaviour, 'We could discuss a refund or another option after I review the case.', { scenario: scenario(), stepIndex: 1, now: 1_800_000_000_000 });
  assert.equal(first.pendingDecision.type, 'negotiation');
  assert.equal(first.behaviour.negotiationCount, 1);
  assert.match(first.customerMessage, /what is confirmed|approval/i);
  assert.equal(voiceCustomerOutcome(behaviour).defaultDisposition, 'escalated');
  const resolved = resolveVoiceCustomerDecision(behaviour, 'check_authority', { now: 1_800_000_001_000 });
  assert.equal(resolved.option.id, 'check_authority');
  assert.equal(resolved.behaviour.negotiationResolved, true);
  assert.equal(resolved.behaviour.pendingDecision, null);
  assert.match(resolved.customerMessage, /conditions|approved option/i);
});

test('unsupported guarantees create a quality flag and supervisor escalation', () => {
  const contact = customer('VOICE-PROMISE');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const prior = behaviour.sentiment;
  const result = evaluateVoiceAgentUtterance(behaviour, 'I guarantee this will be reversed immediately. Stop complaining.', { scenario: scenario(), stepIndex: 1, now: 1_800_000_000_000 });
  assert.ok(result.behaviour.sentiment < prior);
  assert.ok(result.behaviour.qualityFlags.includes('unverified_commitment'));
  assert.equal(result.behaviour.needsSupervisor, true);
  assert.ok(result.scoreDelta < 0);
});

test('guided scenario breaches are retained as critical handling flags', () => {
  const contact = customer('VOICE-GUIDED-BREACH');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  const result = evaluateVoiceCustomerTurn(behaviour, { text: 'Proceed because the customer knows the transaction amount.', score: -5, breach: true }, { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 });
  assert.equal(result.breach, true);
  assert.ok(result.behaviour.qualityFlags.includes('critical_handling_breach'));
  assert.equal(result.behaviour.needsSupervisor, true);
});

test('the engine enforces a maximum number of live agent turns', () => {
  const contact = customer('VOICE-LIMIT');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  for (let turn = 0; turn < VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns; turn += 1) {
    evaluateVoiceCustomerTurn(behaviour, { text: `I understand. I will review the case and explain the next step ${turn}.`, score: 2 }, { scenario: scenario(), stepIndex: 0, now: 1_800_000_000_000 + turn * 1000 });
  }
  assert.throws(() => evaluateVoiceCustomerTurn(behaviour, { text: strongResponse, score: 2 }, { scenario: scenario(), stepIndex: 2, now: 1_800_000_010_000 }), /maximum conversation turns/i);
});

test('voice outcome converts unresolved quality or emotion risk into escalation', () => {
  const contact = customer('VOICE-OUTCOME');
  const call = callFor(contact.id);
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  assert.equal(voiceCustomerOutcome(behaviour).defaultDisposition, 'resolved');
  behaviour.qualityFlags.push('unverified_commitment');
  behaviour.needsSupervisor = true;
  const outcome = voiceCustomerOutcome(behaviour);
  assert.equal(outcome.defaultDisposition, 'escalated');
  assert.equal(outcome.outcome, 'escalation_required');
  assert.ok(outcome.customerSatisfaction < 3);
});

test('legacy transcript and saved voice state survive normalisation', () => {
  const contact = customer('VOICE-MIGRATE');
  const call = callFor(contact.id);
  call.voiceBehaviour = {
    personaId: 'frustrated', sentiment: 31, patience: 17, turns: 2,
    messages: [{ speaker: 'customer', text: 'I need an update.', at: '2026-11-17T08:00:00.000Z' }],
    history: [{ turn: 1 }]
  };
  const behaviour = ensureVoiceCustomerBehaviour(call, contact, scenario());
  assert.equal(behaviour.personaId, 'frustrated');
  assert.equal(behaviour.sentiment, 31);
  assert.equal(behaviour.turns, 2);
  assert.equal(behaviour.transcript.length, 1);
  assert.equal(behaviour.history.length, 1);
});

test('transcript sanitation removes credential values and full card numbers', () => {
  const value = sanitizeVoiceCustomerText('My PIN is 1234 and my card number is 4111111111111111');
  assert.doesNotMatch(value, /1234|4111111111111111/);
  assert.match(value, /REDACTED/i);
});
