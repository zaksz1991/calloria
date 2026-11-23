import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';
import {
  buildWorkforceTrendCloudHealthReportV806,
  workforceTrendCloudHealthOverallLabelV806,
  WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806
} from '../js/workforce-trend-cloud-health-engine-v806.js';
import { WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 } from '../js/workforce-trend-cloud-sync-engine-v803.js';
import { WORKFORCE_TREND_BACKUP_VERSION_V805 } from '../js/workforce-trend-backup-engine-v805.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginSource = fs.readFileSync(path.join(root, 'build/calloria-workforce-trend-cloud-sync-v801.mjs'), 'utf8');
const V731_MARKER = '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */';
const V731_IMPORT = "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';";
const STATUS_ANCHOR = '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>';

function passingChecks() {
  return [
    ['workspace', 'Organisation workspace'],
    ['auth_session', 'Supabase user session'],
    ['permissions', 'Workforce report permission'],
    ['local_history', 'Browser-local history'],
    ['snapshot_store', 'Organisation snapshot storage'],
    ['conflict_archive', 'Durable conflict archive'],
    ['backup_integrity', 'Recovery and integrity tools']
  ].map(([id, label]) => ({ id, label, status: 'passed', detail: 'Verified.' }));
}

test('v8.6 health engine and its predecessor dependencies are pinned', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806, '8.6.0');
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803, '8.4.0');
  assert.equal(WORKFORCE_TREND_BACKUP_VERSION_V805, '8.5.0');
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  assert.equal(plugin.version, '8.6.0');
  assert.equal(plugin.name, 'calloria-workforce-trend-cloud-sync-v8-1');
});

test('a complete healthy report requires all seven bounded checks', () => {
  const report = buildWorkforceTrendCloudHealthReportV806({ checks: passingChecks(), checkedAt: '2026-11-23T12:00:00.000Z' });
  assert.equal(report.overall, 'healthy');
  assert.equal(report.passed, 7);
  assert.equal(report.warnings, 0);
  assert.equal(report.failed, 0);
  assert.equal(report.checks.length, 7);
  assert.equal(workforceTrendCloudHealthOverallLabelV806(report.overall), 'All checks passed');
});

test('warnings and failures are classified without masking blocked cloud access', () => {
  const checks = passingChecks();
  checks[1] = { ...checks[1], status: 'warning', detail: 'Session needs refresh.' };
  checks[4] = { ...checks[4], status: 'failed', detail: 'Table unavailable.' };
  const report = buildWorkforceTrendCloudHealthReportV806({ checks });
  assert.equal(report.overall, 'blocked');
  assert.equal(report.warnings, 1);
  assert.equal(report.failed, 1);
  assert.equal(workforceTrendCloudHealthOverallLabelV806(report.overall), 'Cloud history is not ready');
});

test('health report rejects unknown/duplicate checks and bounds text and record counts', () => {
  const report = buildWorkforceTrendCloudHealthReportV806({ checks: [
    { id: 'workspace', label: 'Workspace', status: 'passed', detail: '<img src=x onerror=alert(1)>', count: 999 },
    { id: 'workspace', label: 'Duplicate', status: 'failed', detail: 'Should be ignored.' },
    { id: 'not-a-check', label: 'Injected', status: 'failed', detail: 'Ignore me.' },
    { id: 'local_history', label: 'Local', status: 'passed', detail: 'ok', count: -5 }
  ] });
  assert.equal(report.checks.length, 2);
  assert.equal(report.checks[0].count, 90);
  assert.equal(report.checks[1].count, 0);
  assert.equal(report.checks[0].detail.includes('<img'), true); // displayed only through textContent in the UI
  assert.equal(report.overall, 'incomplete');
});

test('the cloud plugin injects the read-only health panel and preserves existing recovery controls', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const source = [
    V731_MARKER,
    V731_IMPORT,
    STATUS_ANCHOR,
    'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
    'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.'
  ].join('\n');
  const warnings = [];
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, source, '/repo/js/main.js');
  assert.deepEqual(warnings, []);
  assert.ok(result?.code);
  assert.match(result.code, /workforce-trend-cloud-health-engine-v806\.js/);
  assert.match(result.code, /data-workforce-cloud-health-check/);
  assert.match(result.code, /data-workforce-cloud-health/);
  assert.match(result.code, /CALLORIA_V806_WORKFORCE_CLOUD_HEALTH/);
  assert.match(result.code, /Run read-only health check/);
  assert.match(result.code, /data-workforce-trend-backup-export/);
  assert.match(result.code, /window\.__CALLORIA_V806_CLOUD_HEALTH_REPORT__ = report/);
  assert.match(result.code, /renderWorkforceTrendCloudHealthV806\(window\.__CALLORIA_V806_CLOUD_HEALTH_REPORT__\)/);
});

test('the v8.6 health check is read-only and scopes both table reads to the active organisation', () => {
  const start = pluginSource.indexOf("'async function runWorkforceTrendCloudHealthV806() {");
  const end = pluginSource.indexOf("'if (typeof window !== \"undefined\"", start);
  assert.ok(start >= 0 && end > start);
  const body = pluginSource.slice(start, end);
  assert.match(body, /calloria_workforce_trend_snapshots/);
  assert.match(body, /calloria_workforce_trend_conflicts/);
  assert.equal((body.match(/\.eq\("organization_id", organizationId\)/g) || []).length, 2);
  assert.equal((body.match(/\.select\(/g) || []).length, 2);
  assert.doesNotMatch(body, /\.rpc\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  assert.match(body, /getSession\(\)/);
  assert.match(pluginSource, /does not insert, update, delete, synchronise, resolve conflicts or restore history/i);
});

test('the plugin transform is idempotent and refuses a partially matching baseline', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const source = [V731_MARKER, V731_IMPORT, STATUS_ANCHOR].join('\n');
  const first = plugin.transform.call({ warn() {} }, source, '/repo/js/main.js');
  assert.ok(first?.code);
  assert.equal(plugin.transform.call({ warn() {} }, first.code, '/repo/js/main.js'), null);
  const warnings = [];
  assert.equal(plugin.transform.call({ warn: message => warnings.push(message) }, '/* unrelated */', '/repo/js/main.js'), null);
  assert.equal(warnings.length, 1);
});
