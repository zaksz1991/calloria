import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = await readFile(resolve(root, 'vite.config.js'), 'utf8');

test('v7.30 command-centre plugin is imported and registered after v7.29', () => {
  assert.match(config, /import \{ calloriaWorkforceCommandCentrePluginV730 \} from '\.\/build\/calloria-workforce-command-centre-v730\.mjs';/);
  const v729 = config.indexOf('calloriaWorkforceIntelligencePluginV729()');
  const v730 = config.indexOf('calloriaWorkforceCommandCentrePluginV730()');
  assert.ok(v729 >= 0 && v730 > v729);
  assert.equal((config.match(/calloriaWorkforceCommandCentrePluginV730\(\)/g) || []).length, 1);
});

test('v7.30 leaves the multi-page build entries and asset handling intact', () => {
  for (const entry of ['main:', 'customerCare:', 'agentDesk:', 'workforce:', 'operationsIntelligence:', 'assetInspector:']) {
    assert.ok(config.includes(entry), `missing existing Vite input ${entry}`);
  }
  assert.match(config, /publicDir: 'public'/);
  assert.match(config, /outDir: 'dist'/);
  assert.match(config, /emptyOutDir: true/);
});
