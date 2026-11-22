import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite config imports the v7.25 digital follow-up coaching plugin', () => {
  assert.ok(config.includes("import { calloriaDigitalFollowUpCoachingPluginV725 } from './build/calloria-digital-followup-coaching-v725.mjs';"));
});

test('v7.25 executes after the v7.24 performance integration', () => {
  const v724 = config.indexOf('calloriaDigitalFollowUpPerformancePluginV724()');
  const v725 = config.indexOf('calloriaDigitalFollowUpCoachingPluginV725()');
  assert.ok(v724 >= 0);
  assert.ok(v725 > v724);
});

test('existing 3D, OJT, multichannel and Vite page-entry registrations remain present', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()',
    'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()',
    'calloriaDigitalExperienceSuitePluginV722()',
    'calloriaDigitalFollowUpSupervisorPluginV723()',
    'calloriaDigitalFollowUpPerformancePluginV724()',
    "main: resolve(process.cwd(), 'index.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')",
    "calloriaChatWidget: resolve(process.cwd(), 'widgets/calloria-chat.js')"
  ]) assert.ok(config.includes(expected), `missing preserved Vite registration: ${expected}`);
});
