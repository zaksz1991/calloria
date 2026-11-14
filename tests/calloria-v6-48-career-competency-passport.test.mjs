import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV648Test as api } from '../build/calloria-career-competency-passport-v6-48.mjs';

const fixturePath = new URL('./fixtures/career-competency-passport-v6-47.fixture.js', import.meta.url);
const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });
const record = (overrides = {}) => ({
  id: 'coach-1', source: 'qa-human-review-v646', criterionId: 'customer-empathy', topic: 'QA improvement · Empathy',
  status: 'action_plan_open', sourceReviewId: 'QA-001', sourceInteractionId: 'CALL-001', practiceAttempts: [], ...overrides
});

test('maps all defined QA criterion families to the intended competencies', () => {
  assert.equal(api.classify(record({ criterionId: 'compliance-remediation' })), 'security');
  assert.equal(api.classify(record({ criterionId: 'active-listening' })), 'communication');
  assert.equal(api.classify(record({ criterionId: 'case-ownership' })), 'ownership');
  assert.equal(api.classify(record({ criterionId: 'crm-documentation' })), 'crm');
  assert.equal(api.classify(record({ criterionId: 'product-knowledge' })), 'knowledge');
  assert.equal(api.classify(record({ criterionId: 'ethical-cross-sell' })), 'sales');
  assert.equal(api.classify(record({ criterionId: 'other-standard', topic: 'General QA behaviour' })), 'service');
});

test('counts only human-confirmed improvement as verified', () => {
  const rows = api.buildPassport([
    record({ id: 'a', status: 'verified', followUp: { outcome: 'improved', reviewer: 'Supervisor' } }),
    record({ id: 'b', status: 'reopened', followUp: { outcome: 'needs_more_practice' } }),
    record({ id: 'c', status: 'delivered', practiceAttempts: [{ score: 100 }, { score: 67 }] })
  ]);
  const communication = rows.find(item => item.id === 'communication');
  assert.equal(communication.plans, 3);
  assert.equal(communication.verified, 1);
  assert.equal(communication.active, 2);
  assert.equal(communication.practiceAttempts, 2);
  assert.equal(communication.percent, 33);
  assert.equal(communication.status, 'PARTIALLY VERIFIED');
});

test('does not treat 100% guided practice as qualification evidence', () => {
  const rows = api.buildPassport([record({ practiceAttempts: [{ score: 100 }], status: 'delivered' })]);
  const communication = rows.find(item => item.id === 'communication');
  assert.equal(communication.verified, 0);
  assert.equal(communication.practiceAttempts, 1);
  assert.equal(communication.status, 'IN DEVELOPMENT');
});

test('ignores unrelated coaching history and non-QA records', () => {
  const rows = api.buildPassport([
    record({ source: 'manual-team-leader-coaching' }),
    { id: 'other', source: 'qa-human-review-v646', criterionId: 'security', status: 'verified', followUp: { outcome: 'needs_more_practice' } }
  ]);
  assert.equal(rows.reduce((sum, item) => sum + item.plans, 0), 1);
  const security = rows.find(item => item.id === 'security');
  assert.equal(security.verified, 0);
  assert.equal(security.status, 'REVIEW REQUIRED');
});

test('renders every passport competency even before QA evidence exists', () => {
  const rows = api.buildPassport([]);
  assert.equal(rows.length, 7);
  assert.ok(rows.every(item => item.status === 'NOT YET EVIDENCED' && item.percent === 0));
});

test('transforms current career renderer once and adds the passport after existing employment panels', async () => {
  const fixture = await readFile(fixturePath, 'utf8');
  const ctx = context();
  const result = api.transformMain(ctx, fixture);
  assert.ok(result);
  assert.match(result.code, new RegExp(api.MARKER));
  assert.match(result.code, /function calloriaRenderCareerCompetencyPassportV648\(\)/);
  assert.match(result.code, /\$\{calloriaRenderCareerCompetencyPassportV648\(\)\}/);
  assert.match(result.code, /promotion eligibility/);
  assert.deepEqual(ctx.warnings, []);
  const twice = api.transformMain(ctx, result.code);
  assert.equal(twice, null);

  const dir = await mkdtemp(join(tmpdir(), 'calloria-v648-'));
  const out = join(dir, 'career-fixture.mjs');
  try {
    await writeFile(out, result.code);
    const check = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('safely skips when v6.47 or any exact career anchor is missing', async () => {
  const fixture = await readFile(fixturePath, 'utf8');
  const ctx = context();
  assert.equal(api.transformMain(ctx, fixture.replace(api.PREREQUISITE, '')), null);
  assert.match(ctx.warnings.join(' '), /v6\.47.*missing/i);
  const changed = context();
  assert.equal(api.transformMain(changed, fixture.replace('data-action="reset-simulation">Reset local simulation data', 'data-action="reset-data">Reset data')), null);
  assert.match(changed.warnings.join(' '), /career profile insertion point/i);
});

test('Vite registration runs v6.48 after v6.47 and retains all earlier project plugins', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-career-competency-passport-v6-48\.mjs/);
  assert.ok(config.indexOf('calloriaGuidedCoachingPracticePlugin()') < config.indexOf('calloriaCareerCompetencyPassportPlugin()'));
  assert.match(config, /calloriaOJTGLBActivationPlugin\(\)/);
  assert.match(config, /calloriaMobileResponsiveRepairPlugin\(\)/);
  assert.match(config, /rollupOptions/);
});
