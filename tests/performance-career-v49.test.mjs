import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Engine = require('../public/performance-career-engine.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
function strongScores() {
  return { customerHandling: 90, crmAccuracy: 90, policyKnowledge: 90, problemSolving: 90, roleReadiness: 90, customerCareDuty: 90 };
}
function weakScores() {
  return { customerHandling: 70, crmAccuracy: 70, policyKnowledge: 70, problemSolving: 70, roleReadiness: 70, customerCareDuty: 70 };
}
function makeEligibleState(year = 2026) {
  const state = Engine.createInitialState(`${year}-11-11`);
  const base = state.reviews.find((item) => item.agentId === 'ag-104');
  const review = Engine.createReview({
    agentId: 'ag-104', period: `${year}-10`, reviewer: 'Test reviewer',
    metrics: { ...base.metrics }, notes: 'Test review'
  });
  state.reviews = state.reviews.filter((item) => !(item.agentId === 'ag-104' && item.period === review.period));
  state.reviews.push(review);
  return state;
}

test('KPI weights total 100 and produce a weighted score', () => {
  assert.equal(Engine.KPI_WEIGHTS.reduce((sum, item) => sum + item.weight, 0), 100);
  const result = Engine.calculatePerformanceScore({ qa: 100, csat: 100, fcr: 100, adherence: 100, productivity: 100, attendance: 100, compliance: 100 });
  assert.equal(result.score, 100);
  assert.equal(result.grade, 'Exceptional');
});

test('KPI inputs are clamped to the 0–100 range', () => {
  const result = Engine.calculatePerformanceScore({ qa: 120, csat: -20, fcr: 'not-a-number', adherence: 100, productivity: 100, attendance: 100, compliance: 100 });
  assert.equal(result.normalized.qa, 100);
  assert.equal(result.normalized.csat, 0);
  assert.equal(result.normalized.fcr, 0);
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('monthly review creation validates period and all required evidence fields', () => {
  const state = Engine.createInitialState('2026-11-11');
  const record = Engine.createReview({ agentId: 'ag-104', period: '2026-11', metrics: state.reviews[0].metrics });
  assert.equal(record.agentId, 'ag-104');
  assert.ok(record.score > 0);
  assert.throws(() => Engine.createReview({ agentId: 'ag-104', period: 'November 2026', metrics: state.reviews[0].metrics }), /YYYY-MM/);
  assert.throws(() => Engine.createReview({ agentId: 'ag-104', period: '2026-11', metrics: { qa: 90 } }), /Invalid review metric/);
});

test('customer-care duty is mandatory and measured independently from department', () => {
  const state = Engine.createInitialState('2026-11-11');
  const quality = state.staff.find((item) => item.id === 'ag-131');
  const review = Engine.getLatestReview(state, quality.id, 2026);
  assert.equal(quality.department, 'quality');
  assert.equal(Engine.getCustomerCareCompliance(review).compliant, true);
  review.metrics.customerCareHours = 7;
  assert.equal(Engine.getCustomerCareCompliance(review).compliant, false);
  const departments = Engine.getDepartmentSummary(state, 2026);
  assert.ok(departments.every((item) => item.universalDuty === true));
});

test('promotion eligibility requires tenure, KPI, QA, compliance, attendance, training and frontline duty', () => {
  const state = makeEligibleState();
  const result = Engine.getPromotionEligibility(state, 'ag-104', 2026, '2026-11-11');
  assert.equal(result.eligible, true);
  const review = Engine.getLatestReview(state, 'ag-104', 2026);
  review.metrics.customerCareContacts = 19;
  const blocked = Engine.getPromotionEligibility(state, 'ag-104', 2026, '2026-11-11');
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.reasons.some((reason) => reason.includes('20 customer contacts')));
});

test('promotion requires a current-year review and six months at level', () => {
  const state = Engine.createInitialState('2026-11-11');
  const newHire = state.staff.find((item) => item.id === 'ag-108');
  newHire.levelSince = '2026-09-01';
  assert.ok(Engine.getPromotionEligibility(state, 'ag-108', 2026, '2026-11-11').reasons.some((reason) => reason.includes('6 months')));
  newHire.levelSince = '2026-03-01';
  assert.ok(!Engine.getPromotionEligibility(state, 'ag-108', 2026, '2026-11-11').reasons.some((reason) => reason.includes('6 months')));
});

test('promotion entry rejects stale performance reviews older than two months', () => {
  const state = makeEligibleState();
  const review = Engine.getLatestReview(state, 'ag-104', 2026);
  review.period = '2026-08';
  const eligibility = Engine.getPromotionEligibility(state, 'ag-104', 2026, '2026-12-31');
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reasons.some((reason) => reason.includes('review is 4 months old')));
});

test('annual promotion exam score uses weighted domains and pass mark', () => {
  assert.equal(Engine.calculateExamScore(strongScores()).score, 90);
  assert.equal(Engine.calculateExamScore(strongScores()).passed, true);
  assert.equal(Engine.calculateExamScore(weakScores()).passed, false);
});

test('successful promotion advances exactly one career level', () => {
  const state = makeEligibleState();
  const result = Engine.recordPromotionExam(state, { agentId: 'ag-104', year: 2026, date: '2026-11-11', scores: strongScores(), assessor: 'Panel' });
  assert.equal(result.promoted, true);
  assert.equal(state.staff.find((item) => item.id === 'ag-104').level, 'senior');
  assert.equal(state.staff.find((item) => item.id === 'ag-104').levelSince, '2026-11-11');
  assert.equal(state.exams[0].outcome, 'Passed');
});

test('failed annual exams are retained and duplicate same-year attempts are blocked', () => {
  const state = makeEligibleState();
  const first = Engine.recordPromotionExam(state, { agentId: 'ag-104', year: 2026, date: '2026-11-11', scores: weakScores() });
  assert.equal(first.promoted, false);
  assert.throws(() => Engine.recordPromotionExam(state, { agentId: 'ag-104', year: 2026, date: '2026-11-20', scores: strongScores() }), /already recorded/);
  assert.equal(state.exams.filter((item) => item.agentId === 'ag-104').length, 1);
});

test('three failed annual attempts exhaust the promotion opportunity for that target level', () => {
  const state = makeEligibleState(2026);
  for (const year of [2026, 2027, 2028]) {
    state.asOfDate = `${year}-11-11`;
    const period = `${year}-10`;
    const previous = Engine.getLatestReview(state, 'ag-104', year);
    if (!previous) {
      const source = Engine.getLatestReview(state, 'ag-104');
      state.reviews.push(Engine.createReview({ agentId: 'ag-104', period, metrics: { ...source.metrics } }));
    }
    const result = Engine.recordPromotionExam(state, { agentId: 'ag-104', year, date: `${year}-11-11`, scores: weakScores() });
    assert.equal(result.promoted, false);
  }
  const exhausted = Engine.getPromotionEligibility(state, 'ag-104', 2028, '2028-11-11');
  assert.equal(exhausted.eligible, false);
  assert.equal(exhausted.attempts, 3);
  assert.equal(exhausted.remainingAttempts, 0);
  assert.ok(exhausted.reasons.some((reason) => reason.includes('Three annual attempts')));
});

test('promotion attempt is blocked when any eligibility gate fails', () => {
  const state = Engine.createInitialState('2026-11-11');
  assert.throws(() => Engine.recordPromotionExam(state, { agentId: 'ag-119', year: 2026, date: '2026-11-11', scores: strongScores() }), /Promotion exam blocked/);
});

test('QA sync imports same-year supervisor evaluations and recalculates KPI', () => {
  const state = Engine.createInitialState('2026-11-11');
  const storage = memoryStorage({
    [Engine.QA_STORAGE_KEY]: JSON.stringify({ version: 47, evaluations: [
      { agentId: 'ag-104', score: 60, date: '2026-10-08' },
      { agentId: 'ag-104', score: 80, date: '2026-10-19' },
      { agentId: 'ag-104', score: 99, date: '2025-10-19' }
    ] })
  });
  const result = Engine.syncSupervisorQaEvidence(state, storage);
  assert.deepEqual({ imported: result.imported, updatedStaff: result.updatedStaff, available: result.available }, { imported: 2, updatedStaff: 1, available: true });
  const review = Engine.getLatestReview(state, 'ag-104', 2026);
  assert.equal(review.metrics.qa, 70);
  assert.equal(review.linkedEvaluations, 2);
  assert.match(review.source, /Supervisor QA/);
});

test('QA sync ignores unsupported or absent source versions', () => {
  const state = Engine.createInitialState('2026-11-11');
  assert.equal(Engine.syncSupervisorQaEvidence(state, memoryStorage()).available, false);
  const unsupported = memoryStorage({ [Engine.QA_STORAGE_KEY]: JSON.stringify({ version: 46, evaluations: [{ agentId: 'ag-104', score: 99 }] }) });
  assert.equal(Engine.syncSupervisorQaEvidence(state, unsupported).available, false);
});

test('department summaries retain the universal customer-care requirement', () => {
  const state = Engine.createInitialState('2026-11-11');
  const summary = Engine.getDepartmentSummary(state, 2026);
  assert.ok(summary.find((item) => item.id === 'it'));
  assert.ok(summary.find((item) => item.id === 'quality'));
  assert.ok(summary.find((item) => item.id === 'workforce'));
  assert.ok(summary.every((item) => item.requiredCareHours === 8 && item.requiredCareContacts === 20));
});

test('dashboard metrics calculate reviewed headcount and annual exam totals', () => {
  const state = Engine.createInitialState('2026-11-11');
  const metrics = Engine.deriveDashboardMetrics(state, 2026);
  assert.equal(metrics.headcount, 10);
  assert.equal(metrics.reviewed, 10);
  assert.equal(metrics.examAttempts, 0);
  assert.ok(metrics.averageKpi > 0);
  assert.ok(metrics.promotionEligible >= 1);
});

test('state persistence round-trips the performance ledger', () => {
  const state = Engine.createInitialState('2026-11-11');
  const storage = memoryStorage();
  assert.equal(Engine.saveState(state, storage), true);
  const loaded = Engine.loadState(storage);
  assert.equal(loaded.version, 49);
  assert.equal(loaded.staff.length, 10);
  assert.equal(loaded.reviews.length, 10);
});

test('staff creation validates department and career level and prevents duplicate IDs', () => {
  const state = Engine.createInitialState('2026-11-11');
  const created = Engine.addStaff(state, { id: 'ag-new', name: 'Test Agent', department: 'it', level: 'associate', levelSince: '2026-11-11' });
  assert.equal(created.department, 'it');
  assert.equal(created.status, 'Active');
  assert.throws(() => Engine.addStaff(state, { id: 'ag-new', name: 'Duplicate', department: 'it', level: 'associate' }), /already exists/);
  assert.throws(() => Engine.addStaff(state, { name: 'Bad Department', department: 'bank', level: 'agent' }), /valid department/);
});
