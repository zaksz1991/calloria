import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES } from '../build/calloria-production-integration-gate-v8.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('the central workforce suite contains eleven plugins in the correct order', () => {
  const suite = read('build/calloria-workforce-development-suite-v8.mjs');
  assert.equal(CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES.length, 11);
  const expected = [
    'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()',
    'calloriaDigitalFollowUpPerformancePluginV724()',
    'calloriaDigitalFollowUpCoachingPluginV725()',
    'calloriaDigitalFollowUpCoachingOutcomesPluginV726()',
    'calloriaDigitalFollowUpCoachingCheckpointsPluginV727()',
    'calloriaDigitalCareerEvidencePluginV728()',
    'calloriaWorkforceIntelligencePluginV729()',
    'calloriaWorkforceCommandCentrePluginV730()',
    'calloriaWorkforceTrendHistoryPluginV731()',
    'calloriaWorkforceTrendCloudSyncPluginV801()'
  ];
  let previous = -1;
  for (const call of expected) {
    const index = suite.indexOf(call);
    assert.ok(index > previous, `suite must register ${call} after its predecessor`);
    previous = index;
  }
  assert.equal((suite.match(/calloriaWorkforceTrendCloudSyncPluginV801\(\)/g) || []).length, 1);
  assert.match(suite, /'calloria-workforce-trend-cloud-sync-v8-1'/);
});

test('Vite registers only the central suite and then one production integration gate', () => {
  const vite = read('vite.config.js');
  assert.equal((vite.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length, 1);
  assert.equal((vite.match(/calloriaProductionIntegrationGatePluginV8\(\)/g) || []).length, 1);
  assert.doesNotMatch(vite, /calloriaWorkforceTrendCloudSyncPluginV801/);
  assert.ok(vite.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()') < vite.indexOf('calloriaProductionIntegrationGatePluginV8()'));
});

test('preflight and source audit require the cloud-history engine, styles, migration and tests', () => {
  const audit = read('tools/calloria-v8-integration-audit.mjs');
  const preflight = read('tools/calloria-build-preflight.mjs');
  const pkg = JSON.parse(read('package.json'));
  for (const file of [
    'js/workforce-trend-cloud-sync-engine-v801.js',
    'styles/calloria-workforce-trend-cloud-sync-v801.css',
    'supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql',
    'tests/workforce-trend-cloud-sync-v801.test.mjs',
    'tests/workforce-trend-cloud-sync-v801-ui.test.mjs',
    'tests/workforce-trend-cloud-sync-v801-contract.test.mjs'
  ]) assert.ok(audit.includes(file), `integration audit must require ${file}`);
  assert.ok(preflight.includes('202611220001_calloria_workforce_trend_cloud_history.sql'));
  assert.match(pkg.scripts['verify:workforce-cloud-history'], /workforce-trend-cloud-sync-v801/);
  assert.ok(pkg.scripts.test.includes('tests/*.test.mjs'));
});
