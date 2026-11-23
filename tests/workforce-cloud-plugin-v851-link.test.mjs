import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';
import { WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 } from '../js/workforce-trend-cloud-sync-engine-v803.js';
import { WORKFORCE_TREND_BACKUP_VERSION_V805 } from '../js/workforce-trend-backup-engine-v805.js';
import { WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806 } from '../js/workforce-trend-cloud-health-engine-v806.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginPath = path.join(root, 'build/calloria-workforce-trend-cloud-sync-v801.mjs');
const pluginSource = fs.readFileSync(pluginPath, 'utf8');

const v731Import = "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';";
const statusAnchor = '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>';

test('v8.6 cloud plugin retains the direct v8.4 durable conflict-review dependency', () => {
  assert.match(pluginSource, /from ['"]\.\.\/js\/workforce-trend-cloud-sync-engine-v803\.js['"]/);
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803, '8.4.0');
  assert.match(pluginSource, /WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 !== '8\.4\.0'/);
});

test('v8.5 backup engine and v8.6 diagnostics remain direct dependencies', () => {
  assert.match(pluginSource, /from ['"]\.\.\/js\/workforce-trend-backup-engine-v805\.js['"]/);
  assert.equal(WORKFORCE_TREND_BACKUP_VERSION_V805, '8.5.0');
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  assert.equal(plugin.name, 'calloria-workforce-trend-cloud-sync-v8-1');
  assert.equal(plugin.version, '8.6.0');
  assert.equal(WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806, '8.6.0');
  assert.match(pluginSource, /from ['"]\.\.\/js\/workforce-trend-cloud-health-engine-v806\.js['"]/);
});

test('cloud plugin still injects v8.3 conflict review, v8.5 backup and v8.6 health imports into main.js', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const source = [
    '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */',
    v731Import,
    statusAnchor,
    'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
    'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.'
  ].join('\n');
  const warnings = [];
  const result = plugin.transform.call({ warn: (message) => warnings.push(message) }, source, '/calloria/js/main.js');
  assert.deepEqual(warnings, []);
  assert.ok(result?.code);
  assert.match(result.code, /from '\.\/workforce-trend-cloud-sync-engine-v803\.js'/);
  assert.match(result.code, /from '\.\/workforce-trend-backup-engine-v805\.js'/);
  assert.match(result.code, /from '\.\/workforce-trend-cloud-health-engine-v806\.js'/);
  assert.match(result.code, /data-workforce-cloud-health-check/);
  assert.match(result.code, /CALLORIA_V803_WORKFORCE_TREND_CONFLICT_REVIEW/);
  assert.match(result.code, /CALLORIA_V805_WORKFORCE_RECOVERY_BACKUP/);
});
