import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV648Test as v648 } from '../build/calloria-career-competency-passport-v6-48.mjs';
import { __calloriaV649Test as api } from '../build/calloria-promotion-readiness-dossier-v6-49.mjs';

const fixturePath = new URL('./fixtures/career-competency-passport-v6-47.fixture.js', import.meta.url);
const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });

function strongState(overrides = {}) {
  return {
    callsHandled: 30,
    outboundCalls: 10,
    qaCount: 4,
    totalQA: 360,
    csatCount: 4,
    totalCSAT: 19,
    incidents: 0,
    experience: 30,
    level: 8,
    promotionAttempts: [],
    ...overrides
  };
}

test('matches the Workforce KPI formulas and 30/20/15/15/10/10 promotion weights', () => {
  const model = api.buildReadiness({ state: strongState(), year: 2026, minimumScore: 75 });
  assert.deepEqual(model.metrics, {
    kpi: 100,
    qa: 90,
    csat: 5,
    knowledge: 100,
    compliance: 95,
    leadership: 100
  });
  // 30 + 18 + 0.75 + 15 + 9.5 + 10 = 83.25 -> 83.3
  assert.equal(model.score, 83.3);
  assert.deepEqual(model.weights, { kpi: 30, qa: 20, csat: 15, knowledge: 15, compliance: 10, leadership: 10 });
  assert.equal(model.eligible, true);
  assert.equal(model.status, 'ELIGIBLE FOR ANNUAL EXAM');
});

test('uses the exact existing Workforce baseline values before activity is recorded', () => {
  const model = api.buildReadiness({ state: {}, year: 2026 });
  assert.deepEqual(model.metrics, {
    kpi: 0, qa: 75, csat: 75, knowledge: 70, compliance: 95, leadership: 65
  });
  assert.equal(model.score, 52.8);
  assert.equal(model.eligible, false);
});

test('respects the organisation-configured threshold without silently changing the policy', () => {
  const state = strongState({ totalCSAT: 16 });
  const model = api.buildReadiness({ state, minimumScore: 90, year: 2026 });
  assert.equal(model.minimumScore, 90);
  assert.equal(model.eligible, false);
  assert.match(model.reason, /below the organisation threshold of 90%/);
});

test('allows only one annual examination attempt per calendar year', () => {
  const state = strongState({ promotionAttempts: [{ id: 'PROM-2026-1', year: 2026, examScore: 62, status: 'not_passed' }] });
  const model = api.buildReadiness({ state, year: 2026 });
  assert.equal(model.attemptsThisYear, 1);
  assert.equal(model.eligible, false);
  assert.equal(model.status, 'NEXT ANNUAL CYCLE');
  assert.match(model.reason, /already recorded for 2026/);
});

test('preserves the three-attempt lifetime cap even when the weighted score is high', () => {
  const state = strongState({ promotionAttempts: [
    { year: 2024, examScore: 65, status: 'not_passed' },
    { year: 2025, examScore: 68, status: 'not_passed' },
    { year: 2026, examScore: 71, status: 'passed' }
  ] });
  const model = api.buildReadiness({ state, year: 2027 });
  assert.equal(model.score >= model.minimumScore, true);
  assert.equal(model.attemptsRemaining, 0);
  assert.equal(model.eligible, false);
  assert.equal(model.status, 'ATTEMPTS EXHAUSTED');
});

test('orders the three weakest development dimensions and attaches specific action guidance', () => {
  const state = strongState({
    callsHandled: 2,
    outboundCalls: 0,
    qaCount: 2,
    totalQA: 80,
    csatCount: 2,
    totalCSAT: 6,
    incidents: 2,
    experience: 2,
    level: 1
  });
  const model = api.buildReadiness({ state, year: 2026 });
  assert.deepEqual(model.priorities.map(item => item.key), ['csat', 'kpi', 'qa']);
  assert.ok(model.priorities.every(item => item.label && item.action));
});

test('uses policy defaults safely and tolerates malformed state arrays and numeric values', () => {
  const model = api.buildReadiness({ state: { callsHandled: 'bad', promotionAttempts: null, incidents: -3 }, year: 2026, minimumScore: NaN });
  assert.equal(model.minimumScore, 75);
  assert.equal(model.metrics.kpi, 0);
  assert.equal(model.metrics.compliance, 95);
  assert.equal(model.totalAttempts, 0);
  assert.equal(model.attemptsRemaining, 3);
});

test('transforms after v6.48, renders a live dossier and remains idempotent', async () => {
  const fixture = await readFile(fixturePath, 'utf8');
  const v648Context = context();
  const v648Result = v648.transformMain(v648Context, fixture);
  assert.ok(v648Result);
  assert.deepEqual(v648Context.warnings, []);

  const ctx = context();
  const result = api.transformMain(ctx, v648Result.code);
  assert.ok(result);
  assert.match(result.code, new RegExp(api.MARKER));
  assert.match(result.code, /function calloriaRenderPromotionReadinessV649\(\)/);
  assert.match(result.code, /Promotion readiness dossier/);
  assert.match(result.code, /calloriaRenderCareerCompetencyPassportV648\(\)\}\$\{calloriaRenderPromotionReadinessV649\(\)\}/);
  assert.deepEqual(ctx.warnings, []);
  assert.equal(api.transformMain(ctx, result.code), null);

  const dir = await mkdtemp(join(tmpdir(), 'calloria-v649-'));
  const out = join(dir, 'career-dossier-fixture.mjs');
  try {
    await writeFile(out, result.code);
    const check = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('skips safely if the v6.48 passport or exact Career insertion point is absent', async () => {
  const fixture = await readFile(fixturePath, 'utf8');
  const withoutV648 = context();
  assert.equal(api.transformMain(withoutV648, fixture), null);
  assert.match(withoutV648.warnings.join(' '), /v6\.48.*missing/i);

  const v648Result = v648.transformMain(context(), fixture);
  const changed = context();
  assert.equal(api.transformMain(changed, v648Result.code.replace(api.CAREER_INSERTION_ANCHOR, '')), null);
  assert.match(changed.warnings.join(' '), /insertion point/i);
});

test('dossier is read-only and does not award promotions or mutate examination history', () => {
  const state = strongState();
  const original = JSON.stringify(state);
  const model = api.buildReadiness({ state, year: 2026 });
  assert.equal(model.eligible, true);
  assert.equal(JSON.stringify(state), original);
  assert.equal(state.promotionAttempts.length, 0);
});

test('registers v6.49 after v6.48 while preserving the cumulative project build plugins', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-promotion-readiness-dossier-v6-49\.mjs/);
  assert.ok(config.indexOf('calloriaCareerCompetencyPassportPlugin()') < config.indexOf('calloriaPromotionReadinessDossierPlugin()'));
  assert.match(config, /calloriaOJTGLBActivationPlugin\(\)/);
  assert.match(config, /calloriaMobileResponsiveRepairPlugin\(\)/);
  assert.match(config, /rollupOptions/);
});
