import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
test('Vite imports and registers the v7.27 checkpoint plugin after v7.26', () => {
  assert.ok(config.includes("import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from './build/calloria-digital-followup-coaching-checkpoints-v727.mjs';"));
  const v726 = config.indexOf('calloriaDigitalFollowUpCoachingOutcomesPluginV726()');
  const v727 = config.indexOf('calloriaDigitalFollowUpCoachingCheckpointsPluginV727()');
  assert.ok(v726 >= 0 && v727 > v726);
});
test('Vite retains previous game, channel, supervisor and coaching plugins', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()', 'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()', 'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()', 'calloriaDigitalFollowUpPerformancePluginV724()',
    'calloriaDigitalFollowUpCoachingPluginV725()', 'calloriaDigitalFollowUpCoachingOutcomesPluginV726()',
    "main: resolve(process.cwd(), 'index.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')"
  ]) assert.ok(config.includes(expected), `missing preserved registration: ${expected}`);
});
