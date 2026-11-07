import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_LADDERS, CAREER_PATHWAYS, PERFORMANCE_PROFILES, QA_RUBRIC, evaluateQaReview,
  evaluateScorecard, nextCareerTarget, promotionEligibility, scoreExam, validatePromotionTarget
} from '../js/performance-engine.js';

function fullValues(profileId, score = 90) {
  return Object.fromEntries(PERFORMANCE_PROFILES[profileId].metrics.map(([id]) => [id, { score, sampleCount: 10, source: 'Verified monthly system report' }]));
}

test('every scorecard profile has weights that total 100', () => {
  for (const profile of Object.values(PERFORMANCE_PROFILES)) {
    assert.equal(profile.metrics.reduce((sum, metric) => sum + metric[2], 0), 100);
    assert.ok(profile.metrics.length >= 6);
  }
});

test('scorecard requires evidence and a positive sample count for every KPI', () => {
  const values = fullValues('voice_agent');
  delete values.csat;
  const result = evaluateScorecard('voice_agent', values);
  assert.equal(result.complete, false);
  assert.ok(result.missing.includes('csat'));
  values.csat = { score: 90, sampleCount: 0, source: 'report' };
  assert.throws(() => evaluateScorecard('voice_agent', values), /sample count/);
});

test('role weighting calculates balanced scores', () => {
  const values = fullValues('voice_agent', 90);
  values.aht_balance.score = 100;
  values.quality.score = 80;
  const result = evaluateScorecard('voice_agent', values);
  assert.equal(result.complete, true);
  assert.equal(result.score, 88);
  assert.equal(result.gatePass, true);
  assert.equal(result.promotionReady, true);
});

test('critical compliance and QA gates override a high average', () => {
  const values = fullValues('voice_agent', 98);
  values.compliance.score = 60;
  const gateFailure = evaluateScorecard('voice_agent', values);
  assert.equal(gateFailure.score > 90, true);
  assert.equal(gateFailure.gatePass, false);
  assert.equal(gateFailure.promotionReady, false);
  const critical = evaluateScorecard('voice_agent', fullValues('voice_agent', 99), { criticalFail: true });
  assert.equal(critical.score, 99);
  assert.equal(critical.promotionReady, false);
});

test('unsupported job profile and scores outside 0–100 are rejected', () => {
  assert.throws(() => evaluateScorecard('unknown', {}), /supported job/);
  const values = fullValues('email_agent'); values.quality.score = 101;
  assert.throws(() => evaluateScorecard('email_agent', values), /between 0 and 100/);
});

test('QA uses a fixed weighted rubric and fails critical incidents', () => {
  assert.equal(QA_RUBRIC.reduce((sum, row) => sum + row.weight, 0), 100);
  const values = Object.fromEntries(QA_RUBRIC.map(row => [row.id, 95]));
  assert.equal(evaluateQaReview(values).passed, true);
  values.privacy = 40;
  assert.equal(evaluateQaReview(values).passed, false);
  values.privacy = 95;
  assert.equal(evaluateQaReview(values, { criticalFail: true }).passed, false);
});

test('promotion eligibility needs three recent reviewed, quality-gated scorecards', () => {
  const cards = [
    { status:'reviewed', period_start:'2026-10-01', score:90, gate_pass:true, critical_fail:false },
    { status:'reviewed', period_start:'2026-09-01', score:85, gate_pass:true, critical_fail:false },
    { status:'reviewed', period_start:'2026-08-01', score:80, gate_pass:true, critical_fail:false },
    { status:'submitted', period_start:'2026-07-01', score:99, gate_pass:true, critical_fail:false }
  ];
  assert.equal(promotionEligibility(cards).eligible, true);
  cards[1].gate_pass = false;
  assert.equal(promotionEligibility(cards).eligible, false);
  assert.equal(promotionEligibility(cards.slice(0,2)).eligible, false);
});

test('career pathway rejects skipped or invented target roles', () => {
  assert.equal(validatePromotionTarget('voice_agent', CAREER_LADDERS.voice_agent[1], CAREER_LADDERS.voice_agent[0]), 'senior_voice_agent');
  assert.equal(nextCareerTarget('voice_agent', 'senior_voice_agent'), 'customer_care_specialist');
  assert.throws(() => validatePromotionTarget('voice_agent', 'customer_operations_supervisor', 'customer_service_agent'), /next approved step/);
  assert.throws(() => validatePromotionTarget('voice_agent', 'head_of_everything'), /next approved step/);
});

test('exam scoring uses only server-provided answer keys and 80 percent pass mark', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `Q${i}`);
  const key = Object.fromEntries(ids.map(id => [id, 'A']));
  const pass = scoreExam(ids, Object.fromEntries(ids.map((id, i) => [id, i < 10 ? 'A' : 'B'])), key);
  assert.equal(pass.score, 83.3);
  assert.equal(pass.passed, true);
  const fail = scoreExam(ids, Object.fromEntries(ids.map((id, i) => [id, i < 9 ? 'A' : 'B'])), key);
  assert.equal(fail.passed, false);
});

test('exam scorer rejects malformed question sets', () => {
  assert.throws(() => scoreExam(['one'], {}, {}), /question set/);
});
