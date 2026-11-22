import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';

const fixture = [
  "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';",
  '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */',
  "import { getCloudPlatformState, getCloudSupabaseClient, canCloudRole } from './cloud-platform.js';",
  'function escapeHTML(value){ return String(value); }',
  'function readWorkforceTrendHistoryV731(){ return { snapshots: [], available: true }; }',
  'function saveWorkforceTrendHistoryV731(){ return true; }',
  'function renderSupervisor() {}',
  'function renderWorkforceTrendHistoryPanelV731(board){',
  '  const statusText = \"Ready\";',
  '  return `<section>',
  '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>',
  '  </section>`;',
  '}'
].join('\n');

test('v8.1 plugin adds explicit organisation sync controls after v7.31', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const result = plugin.transform.call({ warn: message => { throw new Error(message); } }, fixture, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.match(result.code, /data-workforce-trend-cloud-sync/);
  assert.match(result.code, /data-workforce-trend-cloud-load/);
  assert.match(result.code, /calloria_save_workforce_trend_snapshots/);
  assert.match(result.code, /calloria_workforce_trend_snapshots/);
  assert.match(result.code, /getCloudPlatformState/);
  assert.match(result.code, /canCloudRole\(context\.membership\?\.role, "reports:read"\)/);
  assert.match(result.code, /workforce-trend-cloud-sync-v801\.css/);
});

test('v8.1 plugin ignores non-main modules and is idempotent', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  assert.equal(plugin.transform(fixture, '/repo/js/other.js'), null);
  const first = plugin.transform.call({ warn() {} }, fixture, '/repo/js/main.js');
  assert.ok(first);
  assert.equal(plugin.transform(first.code, '/repo/js/main.js'), null);
});

test('v8.1 plugin fails closed when v7.31 transform anchors are absent', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const warnings = [];
  const result = plugin.transform.call({ warn: value => warnings.push(value) }, 'export const main = true;', '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});


test('transformed v7.31 main module remains valid JavaScript syntax', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const result = plugin.transform.call({ warn: message => { throw new Error(message); } }, fixture, '/repo/js/main.js');
  assert.ok(result?.code);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v801-'));
  const file = path.join(directory, 'main.mjs');
  try {
    fs.writeFileSync(file, result.code);
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
    assert.match(result.code, /setWorkforceCloudStatusV801\(/);
    assert.doesNotMatch(result.code, /(?<!V801)setWorkforceCloudStatus\(/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
