import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite config imports the v7.24 digital follow-up performance plugin', () => {
  assert.ok(config.includes("import { calloriaDigitalFollowUpPerformancePluginV724 } from './build/calloria-digital-followup-performance-v724.mjs';"));
});

test('v7.24 executes after the v7.23 supervisor integration', () => {
  const v723 = config.indexOf('calloriaDigitalFollowUpSupervisorPluginV723(),');
  const v724 = config.indexOf('calloriaDigitalFollowUpPerformancePluginV724()');
  assert.ok(v723 >= 0);
  assert.ok(v724 > v723);
});

test('existing application entries and earlier visual/runtime plugins remain registered', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()',
    'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()',
    'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()',
    "main: resolve(process.cwd(), 'index.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')",
    "calloriaChatWidget: resolve(process.cwd(), 'widgets/calloria-chat.js')"
  ]) assert.ok(config.includes(expected), `missing Vite entry: ${expected}`);
});
