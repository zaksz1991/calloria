import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import {
  transformCalloriaDigitalCompletionV724,
  transformGeneralCustomerExperienceDefaultsV724,
  calloriaDigitalCompletionSuitePluginV724
} from '../build/calloria-digital-completion-suite-v724.mjs';

const fixture = readFileSync(new URL('./fixtures/main-defaults-and-customer-continuity-v724.fixture.mjs', import.meta.url), 'utf8');
const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('new applicants default to General Customer Experience and Customer Experience department', () => {
  const result = transformGeneralCustomerExperienceDefaultsV724(fixture);
  assert.equal(result.changed, true);
  assert.match(result.code, /selectedTrack: 'service'/);
  assert.match(result.code, /department: 'Customer Experience'/);
  assert.match(result.code, /salary: 170000/);
  assert.match(result.code, /legacyDepartmentByTrack = \{ banking: 'Banking Operations', service: 'Customer Experience', technical: 'Technical Support', sales: 'Sales & Retention' \}/);
  assert.doesNotMatch(result.code, /selectedTrack: 'banking'/);
  assert.doesNotMatch(result.code, /department: 'Banking Operations'/);
});

test('existing saved applicant values continue to override fresh defaults', () => {
  const result = transformGeneralCustomerExperienceDefaultsV724(fixture);
  assert.match(result.code, /const migrated = \{ \.\.\.initialState\(\), \.\.\.parsed \};/);
  assert.match(result.code, /legacyDepartmentByTrack\[migrated\.selectedTrack\]/);
  const executable = result.code.replace(/^import .*;\r?\n/m, '') + '\n({ fresh: initialState(), legacyBanking: loadState({ selectedTrack: \"banking\" }), legacyTechnical: loadState({ selectedTrack: \"technical\" }), customSavedDepartment: loadState({ selectedTrack: \"service\", department: \"Existing Custom Department\", salary: 123456 }) })';
  const values = vm.runInNewContext(executable);
  assert.equal(values.fresh.selectedTrack, 'service');
  assert.equal(values.fresh.department, 'Customer Experience');
  assert.equal(values.fresh.salary, 170000);
  assert.equal(values.legacyBanking.department, 'Banking Operations');
  assert.equal(values.legacyBanking.salary, 185000);
  assert.equal(values.legacyTechnical.department, 'Technical Support');
  assert.equal(values.legacyTechnical.salary, 195000);
  assert.equal(values.customSavedDepartment.department, 'Existing Custom Department');
  assert.equal(values.customSavedDepartment.salary, 123456);
});

test('Customer 360 recovery panel is activated after the v7.22 digital suite', () => {
  const result = transformCalloriaDigitalCompletionV724(fixture);
  assert.equal(result.recovery.changed, true);
  assert.equal(result.defaults.changed, true);
  assert.match(result.code, /CALLORIA_V723_CUSTOMER_RECOVERY_PLAN/);
  assert.match(result.code, /assessCustomerRecoveryPlan\(context, \{ channel, now: queueSimulationNowMs\(\) \}\)/);
  assert.match(result.code, /customer-recovery-plan-v723\.css/);
  assert.match(result.code, /\$\{recoveryPlanHtml\}/);
});

test('combined transform is idempotent', () => {
  const once = transformCalloriaDigitalCompletionV724(fixture);
  const twice = transformCalloriaDigitalCompletionV724(once.code);
  assert.equal(twice.changed, false);
  assert.equal(twice.alreadyPatched, true);
  assert.equal(twice.code, once.code);
});

test('changed default anchors are safely skipped without partial default edits', () => {
  const changed = fixture.replace("  department: 'Banking Operations',", "  department: 'Other Department',");
  const result = transformGeneralCustomerExperienceDefaultsV724(changed);
  assert.equal(result.changed, false);
  assert.match(result.reason, /department default/);
  assert.equal(result.code, changed);
});

test('changed Customer 360 anchors do not prevent the independent default-track repair', () => {
  const changed = fixture.replace('function renderCustomerContinuityPanel', 'function renderCustomerPanel');
  const result = transformCalloriaDigitalCompletionV724(changed);
  assert.equal(result.recovery.changed, false);
  assert.equal(result.defaults.changed, true);
  assert.match(result.code, /selectedTrack: 'service'/);
  assert.doesNotMatch(result.code, /CALLORIA_V723_CUSTOMER_RECOVERY_PLAN/);
});

test('plugin only transforms js/main.js', () => {
  const plugin = calloriaDigitalCompletionSuitePluginV724();
  assert.equal(plugin.transform.call({ warn() {} }, fixture, '/repo/js/other.js'), null);
  const result = plugin.transform.call({ warn() {} }, fixture, '/repo/js/main.js');
  assert.ok(result?.code.includes('CALLORIA_V724_GENERAL_CUSTOMER_EXPERIENCE_DEFAULT'));
});

test('Vite config keeps v7.22 and registers the cumulative v7.24 plugin immediately after it', () => {
  assert.equal((config.match(/calloriaDigitalExperienceSuitePluginV722\(\)/g) || []).length, 1);
  assert.equal((config.match(/calloriaDigitalCompletionSuitePluginV724\(\)/g) || []).length, 1);
  assert.ok(config.indexOf('calloriaDigitalExperienceSuitePluginV722()') < config.indexOf('calloriaDigitalCompletionSuitePluginV724()'));
  assert.match(config, /from '\.\/build\/calloria-digital-completion-suite-v724\.mjs'/);
  assert.doesNotMatch(config, /calloriaCustomerRecoveryPlanPluginV723\(\)/);
});


test('transformed main fixture parses as JavaScript', () => {
  const result = transformCalloriaDigitalCompletionV724(fixture);
  const directory = mkdtempSync(join(tmpdir(), 'calloria-v724-'));
  try {
    const file = join(directory, 'transformed.mjs');
    writeFileSync(file, result.code);
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
