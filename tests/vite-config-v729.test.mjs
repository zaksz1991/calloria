import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');
const suite = await readFile(resolve(root, 'build/calloria-workforce-development-suite-v8.mjs'), 'utf8');

test('v729 module is included once in the central v8 suite at the expected stage', () => {
  assert.ok(suite.includes("import { calloriaWorkforceIntelligencePluginV729 } from './calloria-workforce-intelligence-v729.mjs';"));
  assert.equal((suite.match(new RegExp('calloriaWorkforceIntelligencePluginV729\\(\\)', 'g')) || []).length, 1);
  const current = suite.indexOf('calloriaWorkforceIntelligencePluginV729()');
  const previous = suite.indexOf('calloriaDigitalCareerEvidencePluginV728()');
  assert.ok(previous >= 0 && current > previous, 'release must follow its predecessor');
  const next = suite.indexOf('calloriaWorkforceCommandCentrePluginV730()');
  assert.ok(next > current, 'release must precede its successor');
  assert.ok(suite.includes("'calloria-workforce-intelligence-v7-29'"));
});

test('Vite registers the v8 suite once after the original gameplay plugins and keeps the build entries', () => {
  const suite = config.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()');
  const gate = config.indexOf('calloriaProductionIntegrationGatePluginV8()');
  assert.equal((config.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length, 1);
  assert.equal((config.match(/calloriaProductionIntegrationGatePluginV8\(\)/g) || []).length, 1);
  assert.ok(suite > config.indexOf('calloriaTryItStudioPlugin()') && gate > suite);
  for (const expected of ['calloriaGLBWorldPlugin()', 'calloriaOJTGLBActivationPlugin()', 'calloriaMobileResponsiveRepairPlugin()', "main: resolve(process.cwd(), 'index.html')", "assetInspector: resolve(process.cwd(), 'asset-inspector.html')"]) assert.ok(config.includes(expected), `missing preserved integration: ${{expected}}`);
});
