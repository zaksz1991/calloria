import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listScenarios, getScenario, createCallSession, applyAgentAction, holdCall, resumeCall,
  moveToAfterContactWork, setPracticeDisposition, completeCall, scoreCall, buildPracticeRecord
} from '../js/voice-simulator-engine.js';

function coachThroughBasicCall(state, {verification=false, crisis=false, consent=false}={}) {
  applyAgentAction(state,'greet');
  applyAgentAction(state,'empathy');
  applyAgentAction(state,'probe');
  if (verification) applyAgentAction(state,'safe_verify');
  applyAgentAction(state,'explain');
  applyAgentAction(state,'guide');
  applyAgentAction(state,'confirm');
  if (consent) applyAgentAction(state,'ask_marketing_consent');
  if (crisis) applyAgentAction(state,'safety_escalate');
  applyAgentAction(state,'close');
}

test('scenario directory covers portfolio, games, complaints, security and personal guidance', () => {
  const scenarios = listScenarios();
  assert.ok(scenarios.length >= 10);
  assert.ok(scenarios.some(s => s.platform === 'RuffNeck Learn'));
  assert.ok(scenarios.some(s => s.platform === 'RuffNeck Prospector'));
  assert.ok(scenarios.some(s => s.platform === 'RuffNeck Connect'));
  assert.ok(scenarios.some(s => s.platform === 'RuffNeck Social Hub'));
  assert.ok(scenarios.some(s => s.platform === 'Kano Run / Kano Life'));
  assert.ok(scenarios.some(s => s.platform === 'Kano Keke'));
  assert.ok(scenarios.some(s => s.group === 'Personal guidance'));
  assert.ok(scenarios.some(s => s.language === 'ha-NG'));
  assert.ok(scenarios.some(s => s.language === 'yo-NG'));
  assert.ok(scenarios.some(s => s.language === 'ig-NG'));
  assert.ok(scenarios.some(s => s.title.includes('Pidgin')));
});

test('unknown scenario cannot start', () => {
  assert.throws(() => createCallSession('does-not-exist'), /valid practice scenario/);
});

test('normal support call passes all practice gates when handled correctly', () => {
  const state = createCallSession('connect-community',1_000);
  coachThroughBasicCall(state);
  moveToAfterContactWork(state,'resolved');
  setPracticeDisposition(state,'self_service_guided');
  const result = completeCall(state,'Explained community rules and safe participation.',20_000);
  assert.equal(result.score.score,100);
  assert.equal(result.score.passed,true);
  assert.equal(result.score.gateFailed,false);
});

test('account-access scenario requires safe verification before passing', () => {
  const state = createCallSession('learn-course-access',1_000);
  coachThroughBasicCall(state,{verification:false});
  moveToAfterContactWork(state,'resolved');
  const result = completeCall(state,'Explained the secure enrolment account check.',20_000);
  assert.equal(result.score.criteria.find(item => item.key === 'privacy_security').passed,false);
  assert.equal(result.score.passed,false);
});

test('asking for a prohibited secret triggers an automatic critical failure', () => {
  const state = createCallSession('learn-course-access',1_000);
  applyAgentAction(state,'greet');
  applyAgentAction(state,'safe_verify','Please read your OTP to me so I can check the account.');
  assert.ok(state.criticalFailures.includes('requested_prohibited_secret'));
  const result = scoreCall(state,10_000);
  assert.equal(result.gateFailed,true);
  assert.ok(result.score <= 49);
});

test('proactive cross-sell without consent is a critical failure', () => {
  const state = createCallSession('social-hub-campaign',1_000);
  applyAgentAction(state,'greet');
  applyAgentAction(state,'proactive_cross_sell');
  assert.ok(state.criticalFailures.includes('unconsented_marketing'));
  assert.ok(state.criticalFailures.includes('premature_cross_sell'));
  assert.equal(scoreCall(state,5_000).gateFailed,true);
});

test('marketing consent must be asked separately and issue resolved before proactive offer', () => {
  const state = createCallSession('social-hub-campaign',1_000);
  applyAgentAction(state,'greet'); applyAgentAction(state,'empathy'); applyAgentAction(state,'probe');
  applyAgentAction(state,'explain'); applyAgentAction(state,'guide'); applyAgentAction(state,'confirm');
  applyAgentAction(state,'ask_marketing_consent');
  assert.equal(state.marketingConsent,true);
  applyAgentAction(state,'proactive_cross_sell');
  assert.equal(state.criticalFailures.length,0);
});

test('crisis scenario cannot pass without a safeguarding hand-off', () => {
  const state = createCallSession('suspicious-otp-request',1_000);
  coachThroughBasicCall(state,{crisis:false});
  moveToAfterContactWork(state,'unresolved');
  const result = completeCall(state,'Advised official account recovery and safe reporting.',15_000);
  assert.equal(result.score.gateFailed,true);
  assert.ok(result.score.recommendations.includes('Safeguarding hand-off'));
});

test('crisis scenario passes only after safeguarding escalation', () => {
  const state = createCallSession('suspicious-otp-request',1_000);
  coachThroughBasicCall(state,{crisis:true});
  moveToAfterContactWork(state,'safeguarding_escalation');
  const result = completeCall(state,'Explained not to share codes and advised official reporting.',15_000);
  assert.equal(result.score.passed,true);
});

test('hold and resume exclude hold time from active handling time', () => {
  const state = createCallSession('repeat-complaint',1_000);
  holdCall(state,3_000); resumeCall(state,13_000);
  assert.equal(state.totalHoldSeconds,10);
  assert.equal(scoreCall(state,21_000).elapsedSeconds,10);
});

test('practice outcomes persist no conversation transcript or free text', () => {
  const state = createCallSession('career-growth',1_000);
  coachThroughBasicCall(state);
  moveToAfterContactWork(state,'resolved');
  const result = completeCall(state,'Built a practical skills development plan.',11_000);
  const record = buildPracticeRecord(state,result.score);
  assert.equal('messages' in record,false);
  assert.equal('practiceSummary' in record,false);
  assert.equal(record.scenarioId,'career-growth');
});

test('invalid disposition and incomplete outcome summary are rejected', () => {
  const state = createCallSession('career-growth',1_000);
  moveToAfterContactWork(state,'resolved');
  assert.throws(() => setPracticeDisposition(state,'made_up'), /valid practice disposition/);
  assert.throws(() => completeCall(state,'bad',2_000), /at least 12 characters/);
});


test('outbound callback scenario is identified as outbound and requires verification', () => {
  const scenario = getScenario('outbound-case-callback');
  assert.equal(scenario.direction,'outbound');
  assert.equal(scenario.needsVerification,true);
});

test('sharing case details before approved verification is a critical failure', () => {
  const state = createCallSession('outbound-case-callback',1_000);
  applyAgentAction(state,'greet');
  applyAgentAction(state,'explain','I can see the private details of your complaint.');
  assert.ok(state.criticalFailures.includes('disclosure_before_verification'));
  assert.equal(scoreCall(state,4_000).gateFailed,true);
});

test('customer emotion responds to empathy and worsens after an unconsented pitch', () => {
  const upset = createCallSession('repeat-complaint',1_000);
  const initial = upset.emotionIntensity;
  applyAgentAction(upset,'empathy');
  assert.ok(upset.emotionIntensity < initial);
  const sales = createCallSession('social-hub-campaign',1_000);
  const before = sales.emotionIntensity;
  applyAgentAction(sales,'proactive_cross_sell');
  assert.ok(sales.emotionIntensity > before);
});
