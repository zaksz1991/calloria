import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite imports and registers the v7.28 career evidence plugin after v7.27', () => {
  assert.ok(config.includes("import { calloriaDigitalCareerEvidencePluginV728 } from './build/calloria-digital-career-evidence-v728.mjs';"));
  const v727 = config.indexOf('calloriaDigitalFollowUpCoachingCheckpointsPluginV727()');
  const v728 = config.indexOf('calloriaDigitalCareerEvidencePluginV728()');
  assert.ok(v727 >= 0 && v728 > v727);
});

test('Vite retains the 3D workplace, OJT, multichannel, career and v7.23-v7.27 plugin chain', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()',
    'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()',
    'calloriaCareerDevelopmentPluginV688()',
    'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()',
    'calloriaDigitalFollowUpPerformancePluginV724()',
    'calloriaDigitalFollowUpCoachingPluginV725()',
    'calloriaDigitalFollowUpCoachingOutcomesPluginV726()',
    'calloriaDigitalFollowUpCoachingCheckpointsPluginV727()',
    "main: resolve(process.cwd(), 'index.html')",
    "workforce: resolve(process.cwd(), 'workforce.html')",
    "performance: resolve(process.cwd(), 'performance.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')"
  ]) assert.ok(config.includes(expected), `missing preserved Vite registration: ${expected}`);
});
