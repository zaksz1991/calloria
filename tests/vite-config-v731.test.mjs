import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');
const suite = await readFile(resolve(root, 'build/calloria-workforce-development-suite-v8.mjs'), 'utf8');

test('v731 module is included once in the central v8 suite at the expected stage', () => {
  assert.ok(suite.includes("import { calloriaWorkforceTrendHistoryPluginV731 } from './calloria-workforce-trend-history-v731.mjs';"));
  assert.equal((suite.match(new RegExp('calloriaWorkforceTrendHistoryPluginV731\\(\\)', 'g')) || []).length, 1);
  const current = suite.indexOf('calloriaWorkforceTrendHistoryPluginV731()');
  const previous = suite.indexOf('calloriaWorkforceCommandCentrePluginV730()');
  assert.ok(previous >= 0 && current > previous, 'release must follow its predecessor');
  assert.ok(current > suite.indexOf('calloriaDigitalExperienceSuitePluginV722()'));
  assert.ok(suite.includes("'calloria-workforce-trend-history-v7-31'"));
});

test('v8 configuration registers one consolidated suite followed by its production gate', () => {
  const suiteImport = "import { calloriaWorkforceDevelopmentSuitePluginsV8 } from './build/calloria-workforce-development-suite-v8.mjs';";
  const gateImport = "import { calloriaProductionIntegrationGatePluginV8 } from './build/calloria-production-integration-gate-v8.mjs';";
  assert.equal(config.split(suiteImport).length - 1, 1);
  assert.equal(config.split(gateImport).length - 1, 1);
  assert.equal((config.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length, 1);
  assert.ok(config.indexOf('calloriaProductionIntegrationGatePluginV8()') > config.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()'));
});
