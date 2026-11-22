import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite config imports and registers v7.31 after the v7.30 command centre exactly once', () => {
  const importLine = "import { calloriaWorkforceTrendHistoryPluginV731 } from './build/calloria-workforce-trend-history-v731.mjs';";
  assert.equal(config.split(importLine).length - 1, 1);
  assert.equal(config.split('calloriaWorkforceTrendHistoryPluginV731()').length - 1, 1);
  assert.ok(config.indexOf('calloriaWorkforceCommandCentrePluginV730()') < config.indexOf('calloriaWorkforceTrendHistoryPluginV731()'));
  assert.match(config, /calloriaWorkforceTrendHistoryPluginV731\(\)\s*\n\s*\]/);
});
