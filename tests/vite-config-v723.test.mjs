import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite configuration imports v7.23 supervisor plugin', () => {
  assert.ok(config.includes("import { calloriaDigitalFollowUpSupervisorPluginV723 } from './build/calloria-digital-followup-supervisor-v723.mjs';"));
});

test('v7.23 executes after the v7.22 digital experience suite', () => {
  const v722 = config.indexOf('calloriaDigitalExperienceSuitePluginV722(),');
  const v723 = config.indexOf('calloriaDigitalFollowUpSupervisorPluginV723()');
  assert.ok(v722 >= 0);
  assert.ok(v723 > v722);
});

test('existing Vite multi-page inputs and core plugins are retained', () => {
  for (const expected of [
    'calloriaGLBWorldPlugin()', 'calloriaMeshoptRuntimePlugin()',
    'calloriaOJTGLBActivationPlugin()', 'calloriaMobileResponsiveRepairPlugin()',
    "main: resolve(process.cwd(), 'index.html')",
    "assetInspector: resolve(process.cwd(), 'asset-inspector.html')",
    "calloriaChatWidget: resolve(process.cwd(), 'widgets/calloria-chat.js')"
  ]) assert.ok(config.includes(expected), `missing existing Vite configuration entry: ${expected}`);
});
