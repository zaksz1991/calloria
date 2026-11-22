import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
test('Vite imports and registers the v7.26 coaching outcome plugin', () => {
  assert.ok(config.includes("import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from './build/calloria-digital-followup-coaching-outcomes-v726.mjs';"));
  const v725 = config.indexOf('calloriaDigitalFollowUpCoachingPluginV725()');
  const v726 = config.indexOf('calloriaDigitalFollowUpCoachingOutcomesPluginV726()');
  assert.ok(v725 >= 0 && v726 > v725);
});
test('Vite retains core 3D, multichannel, supervisor and prior coaching plugins', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()', 'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()', 'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()', 'calloriaDigitalFollowUpPerformancePluginV724()',
    'calloriaDigitalFollowUpCoachingPluginV725()',
    "main: resolve(process.cwd(), 'index.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')"
  ]) assert.ok(config.includes(expected), `missing preserved registration: ${expected}`);
});
