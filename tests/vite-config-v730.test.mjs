import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');
const suite = await readFile(resolve(root, 'build/calloria-workforce-development-suite-v8.mjs'), 'utf8');

test('v730 module is included once in the central v8 suite at the expected stage', () => {
  assert.ok(suite.includes("import { calloriaWorkforceCommandCentrePluginV730 } from './calloria-workforce-command-centre-v730.mjs';"));
  assert.equal((suite.match(new RegExp('calloriaWorkforceCommandCentrePluginV730\\(\\)', 'g')) || []).length, 1);
  const current = suite.indexOf('calloriaWorkforceCommandCentrePluginV730()');
  const previous = suite.indexOf('calloriaWorkforceIntelligencePluginV729()');
  assert.ok(previous >= 0 && current > previous, 'release must follow its predecessor');
  const next = suite.indexOf('calloriaWorkforceTrendHistoryPluginV731()');
  assert.ok(next > current, 'release must precede its successor');
  assert.ok(suite.includes("'calloria-workforce-command-centre-v7-30'"));
});

test('v8 keeps all original multipage inputs and output settings while registering the consolidated suite', () => {
  const group = config.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()');
  const gate = config.indexOf('calloriaProductionIntegrationGatePluginV8()');
  assert.equal((config.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length, 1);
  assert.equal((config.match(/calloriaProductionIntegrationGatePluginV8\(\)/g) || []).length, 1);
  assert.ok(group > config.indexOf('calloriaTryItStudioPlugin()') && gate > group);
  for (const entry of ['main:', 'customerCare:', 'agentDesk:', 'workforce:', 'operationsIntelligence:', 'assetInspector:']) assert.ok(config.includes(entry));
  assert.match(config, /publicDir: 'public'/);
  assert.match(config, /outDir: 'dist'/);
  assert.match(config, /emptyOutDir: true/);
});
