import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite imports and registers v7.29 after v7.28', () => {
  assert.ok(config.includes("import { calloriaWorkforceIntelligencePluginV729 } from './build/calloria-workforce-intelligence-v729.mjs';"));
  const v728 = config.indexOf('calloriaDigitalCareerEvidencePluginV728()');
  const v729 = config.indexOf('calloriaWorkforceIntelligencePluginV729()');
  assert.ok(v728 >= 0 && v729 > v728);
});

test('Vite retains all previous 3D, workplace, channel and career plugins', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()', 'calloriaOJTGLBActivationPlugin()', 'calloriaMobileResponsiveRepairPlugin()',
    'calloriaCareerDevelopmentPluginV688()', 'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()', 'calloriaDigitalFollowUpPerformancePluginV724()',
    'calloriaDigitalFollowUpCoachingPluginV725()', 'calloriaDigitalFollowUpCoachingOutcomesPluginV726()',
    'calloriaDigitalFollowUpCoachingCheckpointsPluginV727()', 'calloriaDigitalCareerEvidencePluginV728()',
    "main: resolve(process.cwd(), 'index.html')", "workforce: resolve(process.cwd(), 'workforce.html')",
    "performance: resolve(process.cwd(), 'performance.html')", "assetInspector: resolve(process.cwd(), 'asset-inspector.html')"
  ]) assert.ok(config.includes(expected), `missing preserved Vite registration: ${expected}`);
});
