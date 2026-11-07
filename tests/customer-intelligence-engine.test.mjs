import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario,
  evaluateCustomerResponse, submitCustomerTurn, finalizeCustomerScenario,
  customerIntelligenceMetrics
} from '../js/customer-intelligence-engine.js';

test('scenario generation produces deterministic synthetic persona and issue for a seed', () => {
  const a = createCustomerScenario({ seed: 12345 });
  const b = createCustomerScenario({ seed: 12345 });
  assert.equal(a.id, b.id);
  assert.equal(a.persona.id, b.persona.id);
  assert.equal(a.issue.id, b.issue.id);
  assert.ok(CUSTOMER_PERSONAS.some(x => x.id === a.persona.id));
  assert.ok(CUSTOMER_ISSUES.some(x => x.id === a.issue.id));
});

test('explicit persona and issue selections are respected', () => {
  const item = createCustomerScenario({ seed: 1, personaId: 'angry', issueId: 'suspected-fraud', channel: 'Live chat' });
  assert.equal(item.persona.id, 'angry');
  assert.equal(item.issue.id, 'suspected-fraud');
  assert.equal(item.channel, 'Live chat');
});

test('QA detects evidence and rewards clear customer ownership', () => {
  const scenario = createCustomerScenario({ seed: 2, personaId: 'calm', issueId: 'failed-transfer' });
  const result = evaluateCustomerResponse('Good morning. I understand your concern and I will review the transaction reference. What date and time did you make the transfer? I will open a traceable case and explain the next step.', scenario);
  assert.ok(result.score >= 80);
  assert.equal(result.evidence.acknowledgement, true);
  assert.equal(result.evidence.ownership, true);
  assert.equal(result.evidence.probing, true);
  assert.equal(result.evidence.nextStep, true);
  assert.equal(result.criticalBreaches.length, 0);
});

test('credential solicitation triggers mandatory escalation', () => {
  const scenario = createCustomerScenario({ seed: 3, personaId: 'suspicious', issueId: 'suspected-fraud' });
  const result = evaluateCustomerResponse('Hello. Please tell me your password and OTP so I can check this for you.', scenario);
  assert.ok(result.criticalBreaches.includes('credential_solicitation'));
});

test('unverified guarantees and dismissive language are critical QA breaches', () => {
  const scenario = createCustomerScenario({ seed: 4 });
  const result = evaluateCustomerResponse('Hello. Calm down, I guarantee this will be fixed immediately today.', scenario);
  assert.ok(result.criticalBreaches.includes('unverified_guarantee'));
  assert.ok(result.criticalBreaches.includes('dismissive_language'));
});

test('customer turn progresses through adaptive branches and stops after three turns', () => {
  const scenario = createCustomerScenario({ seed: 5, personaId: 'confused', issueId: 'mobile-access' });
  const first = submitCustomerTurn(scenario, 'Good morning. I understand the difficulty and I will help you. What error do you see on the screen? I will explain the next step clearly.');
  assert.equal(first.scenario.turn, 1);
  assert.notEqual(first.scenario.branch, 'opening');
  submitCustomerTurn(scenario, 'I understand your concern. I will check the approved recovery options. What device are you using? I will explain the next step.');
  submitCustomerTurn(scenario, 'Thank you for confirming. I will record the issue and explain the next step. Please follow the approved recovery process.');
  assert.equal(scenario.status, 'completed');
  assert.throws(() => submitCustomerTurn(scenario, 'Another response that should not be accepted.'), /not active/);
});

test('critical breach immediately ends the interaction in mandatory review', () => {
  const scenario = createCustomerScenario({ seed: 6, issueId: 'suspected-fraud' });
  submitCustomerTurn(scenario, 'Hello. Send me your OTP and password so I can help you now.');
  assert.equal(scenario.status, 'escalated');
  assert.equal(scenario.branch, 'mandatory_review');
});

test('final QA record includes dimensions and a mandatory-review outcome', () => {
  const scenario = createCustomerScenario({ seed: 7, issueId: 'suspected-fraud' });
  submitCustomerTurn(scenario, 'Hello. Please give me your PIN and one-time password to verify you.');
  const report = finalizeCustomerScenario(scenario);
  assert.equal(report.outcome, 'mandatory_review');
  assert.equal(report.dataOrigin, 'calloria_customer_lab_synthetic');
  assert.equal(report.aiTranscript[0].speaker, 'customer');
  assert.equal(report.aiTranscript[1].speaker, 'agent');
  assert.ok(report.criticalBreaches.length > 0);
});

test('metrics summarise QA history without inventing scores', () => {
  const result = customerIntelligenceMetrics([
    { averageScore: 90, outcome: 'strong', criticalBreaches: [] },
    { averageScore: 60, outcome: 'coaching', criticalBreaches: [] },
    { averageScore: 10, outcome: 'mandatory_review', criticalBreaches: ['credential_solicitation'] }
  ]);
  assert.equal(result.interactions, 3);
  assert.equal(result.averageQA, 53);
  assert.equal(result.strong, 1);
  assert.equal(result.coaching, 1);
  assert.equal(result.mandatoryReview, 1);
  assert.equal(result.criticalBreaches, 1);
  assert.equal(customerIntelligenceMetrics([]).averageQA, null);
});

test('safe warnings against sharing credentials are not misclassified as solicitation', () => {
  const scenario = createCustomerScenario({ seed: 8 });
  const result = evaluateCustomerResponse('Hello. Please do not share your PIN, password or OTP with anyone. I understand your concern and will explain the next step.', scenario);
  assert.equal(result.criticalBreaches.includes('credential_solicitation'), false);
});
