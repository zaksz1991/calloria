import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import {
  buildWorkforceTrendConflictArchivePayloadV803,
  compareWorkforceTrendConflictSnapshotsV803,
  normaliseWorkforceTrendConflictArchiveRowV803,
  normaliseWorkforceTrendConflictResolutionV803,
  parseWorkforceTrendConflictArchiveResultV803,
  workforceTrendConflictResolutionLabelV803,
  WORKFORCE_TREND_CLOUD_CONFLICT_ARCHIVE_TABLE_V803,
  WORKFORCE_TREND_CLOUD_CONFLICT_RECORD_RPC_V803,
  WORKFORCE_TREND_CLOUD_CONFLICT_RESOLVE_RPC_V803,
  WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803
} from '../js/workforce-trend-cloud-sync-engine-v803.js';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const t0 = '2026-11-22T10:00:00.000Z';

function snapshot(completedReplies, extra = {}) {
  return {
    schemaVersion: 1,
    capturedAt: t0,
    sourceVersion: '7.31.0',
    summary: {
      digitalAgents: 3, completedReplies, openDigitalWork: 4, overdueDigitalWork: 1,
      atRiskDigitalWork: 2, responseTargetRate: 91.5, workstreamsAvailable: 3,
      departmentsAvailable: 2, agentsNeedingSupervisorAttention: 1,
      departmentCoveragePercent: 75, mappedDepartmentAgents: 3, identifiedDigitalAgents: 4
    },
    workstreams: [{ id: 'email', label: 'Email', available: true, completed: completedReplies, responseTargetRate: 90, open: 2, overdue: 1, atRisk: 1 }],
    departments: [{ department: 'Customer Care', agents: 3, completed: completedReplies, responseTargetRate: 90, open: 2, overdue: 1, atRisk: 1 }],
    ...extra
  };
}
const local = snapshot(12, { privateNote: 'must not leave the strict normaliser' });
const cloud = snapshot(8);
const validId = '9f2e52c0-1f7e-4c5b-8f2e-2a6b2f4e32a1';

 test('v8.4 conflict archive uses stable names and version', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803, '8.4.0');
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_ARCHIVE_TABLE_V803, 'calloria_workforce_trend_conflicts');
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_RECORD_RPC_V803, 'calloria_record_workforce_trend_conflicts_v803');
  assert.equal(WORKFORCE_TREND_CLOUD_CONFLICT_RESOLVE_RPC_V803, 'calloria_resolve_workforce_trend_conflict_v803');
});

test('archive payload contains only strict-normalised differing pairs', () => {
  const payload = buildWorkforceTrendConflictArchivePayloadV803([local], [{ snapshot: cloud }]);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].capturedAt, t0);
  assert.equal(payload[0].localSnapshot.summary.completedReplies, 12);
  assert.equal(payload[0].cloudSnapshot.summary.completedReplies, 8);
  assert.equal('privateNote' in payload[0].localSnapshot, false);
  assert.equal(buildWorkforceTrendConflictArchivePayloadV803([cloud], [{ snapshot: cloud }]).length, 0);
});

test('archive payload ignores invalid snapshots and never fabricates conflict pairs', () => {
  assert.deepEqual(buildWorkforceTrendConflictArchivePayloadV803([local], [{ snapshot: { schemaVersion: 2 } }]), []);
  assert.deepEqual(buildWorkforceTrendConflictArchivePayloadV803([], [{ snapshot: cloud }]), []);
});

test('metric comparison exposes only the approved aggregate summary fields', () => {
  const metrics = compareWorkforceTrendConflictSnapshotsV803(local, cloud);
  assert.equal(metrics.length, 7);
  const completed = metrics.find(row => row.key === 'completedReplies');
  assert.equal(completed.localValue, 12);
  assert.equal(completed.cloudValue, 8);
  assert.equal(completed.delta, 4);
  const rate = metrics.find(row => row.key === 'responseTargetRate');
  assert.equal(rate.delta, 0);
  assert.equal(metrics.some(row => /employee|customer|transcript|email/i.test(row.key)), false);
});

test('archive row normaliser accepts valid open rows and rejects malformed or inconsistent variants', () => {
  const base = {
    id: validId, captured_at: t0, local_snapshot: local, cloud_snapshot: cloud,
    status: 'open', resolution: null, created_at: '2026-11-22T11:00:00.000Z', resolved_at: null
  };
  const row = normaliseWorkforceTrendConflictArchiveRowV803(base);
  assert.ok(row);
  assert.equal(row.status, 'open');
  assert.equal(row.localSnapshot.summary.completedReplies, 12);
  assert.equal('privateNote' in row.localSnapshot, false);
  assert.equal(normaliseWorkforceTrendConflictArchiveRowV803({ ...base, captured_at: 'invalid' }), null);
  assert.equal(normaliseWorkforceTrendConflictArchiveRowV803({ ...base, cloud_snapshot: local }), null);
  assert.equal(normaliseWorkforceTrendConflictArchiveRowV803({ ...base, status: 'resolved' }), null);
});

test('archive row normaliser accepts resolved records only with an explicit valid decision', () => {
  const row = normaliseWorkforceTrendConflictArchiveRowV803({
    id: validId, captured_at: t0, local_snapshot: local, cloud_snapshot: cloud,
    status: 'resolved', resolution: 'keep_local', created_at: '2026-11-22T11:00:00Z',
    resolved_at: '2026-11-22T12:00:00Z'
  });
  assert.ok(row);
  assert.equal(row.resolution, 'keep_local');
  assert.equal(normaliseWorkforceTrendConflictArchiveRowV803({
    id: validId, captured_at: t0, local_snapshot: local, cloud_snapshot: cloud,
    status: 'resolved', resolution: 'auto_merge', created_at: '2026-11-22T11:00:00Z',
    resolved_at: '2026-11-22T12:00:00Z'
  }), null);
});

test('resolution normaliser permits only explicit canonical-copy choices', () => {
  assert.equal(normaliseWorkforceTrendConflictResolutionV803('keep_local'), 'keep_local');
  assert.equal(normaliseWorkforceTrendConflictResolutionV803('keep_cloud'), 'keep_cloud');
  for (const value of ['auto', 'merge', 'keep_both', 'delete', '', null]) {
    assert.equal(normaliseWorkforceTrendConflictResolutionV803(value), null);
  }
  assert.equal(workforceTrendConflictResolutionLabelV803('keep_local'), 'Local version selected');
  assert.equal(workforceTrendConflictResolutionLabelV803('keep_cloud'), 'Organisation version retained');
});

test('archive RPC result parser bounds counters and rejects malformed payloads', () => {
  assert.deepEqual(parseWorkforceTrendConflictArchiveResultV803({ recorded: 4.9, unchanged: 95 }), { recorded: 4, unchanged: 90 });
  assert.deepEqual(parseWorkforceTrendConflictArchiveResultV803('{"recorded":2,"unchanged":1}'), { recorded: 2, unchanged: 1 });
  assert.throws(() => parseWorkforceTrendConflictArchiveResultV803('not-json'), /invalid result/);
  assert.throws(() => parseWorkforceTrendConflictArchiveResultV803([]), /invalid result/);
});

test('plugin transforms v7.31 trend history into an archive-and-review workspace', () => {
  const source = [
    '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */',
    "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';",
    'function renderTrendPanel(statusText) {',
    '  return `',
    '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>',
    'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
    'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.',
    '  `;',
    '}'
  ].join('\n');
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const transformed = plugin.transform.call({ warn: message => { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(transformed?.code);
  assert.match(transformed.code, /workforce-trend-cloud-sync-engine-v803\.js/);
  assert.match(transformed.code, /calloria_record_workforce_trend_conflicts_v803/);
  assert.match(transformed.code, /calloria_resolve_workforce_trend_conflict_v803/);
  assert.match(transformed.code, /data-workforce-cloud-conflict-review/);
  assert.match(transformed.code, /data-workforce-cloud-conflict-resolve/);
  assert.match(transformed.code, /textContent/);
  assert.match(transformed.code, /window\.confirm/);
  assert.match(transformed.code, /__CALLORIA_V803_CONFLICT_ROWS__/);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v84-transform-'));
  try {
    const transformedPath = path.join(tempRoot, 'main.mjs');
    fs.writeFileSync(transformedPath, transformed.code);
    const syntax = spawnSync(process.execPath, ['--check', transformedPath], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, `${syntax.stdout}\n${syntax.stderr}`);
  } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  assert.equal(plugin.transform(source, '/repo/js/other.js'), null);
  assert.equal(plugin.transform(`${source}\n/* CALLORIA_V803_WORKFORCE_TREND_CONFLICT_REVIEW */`, '/repo/js/main.js'), null);
});

test('conflict archive migration is append-only, organisation-scoped and decision-gated', () => {
  const sql = read('supabase/migrations/202611220003_calloria_workforce_trend_conflict_archive.sql');
  assert.match(sql, /create table if not exists public\.calloria_workforce_trend_conflicts/);
  assert.match(sql, /calloria_record_workforce_trend_conflicts_v803/);
  assert.match(sql, /calloria_resolve_workforce_trend_conflict_v803/);
  assert.match(sql, /public\.has_calloria_org_permission\(p_org_id, 'reports:read'\)/);
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /on conflict \(organization_id, captured_at, local_fingerprint, cloud_fingerprint\) do nothing/i);
  assert.match(sql, /p_resolution not in \('keep_local', 'keep_cloud'\)/);
  assert.match(sql, /v_current is distinct from v_conflict\.cloud_snapshot/);
  assert.match(sql, /update public\.calloria_workforce_trend_snapshots/);
  assert.match(sql, /revoke all on table public\.calloria_workforce_trend_conflicts from public, anon, authenticated/);
  assert.match(sql, /grant select on table public\.calloria_workforce_trend_conflicts to authenticated/);
  assert.match(sql, /grant execute on function public\.calloria_resolve_workforce_trend_conflict_v803\(uuid, text\) to authenticated/);
  assert.doesNotMatch(sql, /grant insert|grant update|grant delete/i);
});

test('build audit and focused package test command require v8.4 migration, engine and tests', () => {
  const audit = read('tools/calloria-v8-integration-audit.mjs');
  const preflight = read('tools/calloria-build-preflight.mjs');
  const pkg = JSON.parse(read('package.json'));
  for (const file of [
    'js/workforce-trend-cloud-sync-engine-v803.js',
    'supabase/migrations/202611220003_calloria_workforce_trend_conflict_archive.sql',
    'tests/workforce-trend-cloud-sync-v803.test.mjs'
  ]) {
    assert.ok(audit.includes(file));
    assert.ok(preflight.includes(file));
  }
  assert.match(audit, /calloria_resolve_workforce_trend_conflict_v803/);
  assert.match(pkg.scripts['verify:workforce-cloud-history'], /workforce-trend-cloud-sync-v803\.test\.mjs/);
});
