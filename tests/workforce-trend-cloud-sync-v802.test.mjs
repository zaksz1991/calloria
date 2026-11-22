import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectWorkforceTrendCloudConflictsV802,
  mergeWorkforceTrendCloudHistoryV802,
  parseWorkforceTrendCloudSyncResultV802,
  WORKFORCE_TREND_CLOUD_SYNC_RPC_V802,
  WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802
} from '../js/workforce-trend-cloud-sync-engine-v802.js';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function snapshot(capturedAt, completedReplies, extra = {}) {
  return {
    schemaVersion: 1,
    capturedAt,
    sourceVersion: '7.31.0',
    summary: {
      digitalAgents: 3,
      completedReplies,
      openDigitalWork: 4,
      overdueDigitalWork: 1,
      atRiskDigitalWork: 0,
      responseTargetRate: 93.5,
      workstreamsAvailable: 3,
      departmentsAvailable: 1,
      agentsNeedingSupervisorAttention: 1,
      departmentCoveragePercent: 75,
      mappedDepartmentAgents: 3,
      identifiedDigitalAgents: 4
    },
    workstreams: [{ id: 'email', label: 'Email', available: true, completed: completedReplies, open: 2, overdue: 1, atRisk: 0, responseTargetRate: 90 }],
    departments: [{ department: 'Customer Care', agents: 3, completed: completedReplies, open: 2, overdue: 1, atRisk: 0, responseTargetRate: 90 }],
    ...extra
  };
}

const t0 = '2026-11-22T10:00:00.000Z';
const t1 = '2026-11-22T11:00:00.000Z';
const t2 = '2026-11-22T12:00:00.000Z';

test('v8.3 cloud history version and RPC use stable CALLORIA identifiers', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802, '8.3.0');
  assert.equal(WORKFORCE_TREND_CLOUD_SYNC_RPC_V802, 'calloria_sync_workforce_trend_snapshots_v802');
  assert.match(WORKFORCE_TREND_CLOUD_SYNC_RPC_V802, /^calloria_/);
});

test('conflict inspector distinguishes local-only, cloud-only, identical and conflicting capture times', () => {
  const local = [snapshot(t0, 5), snapshot(t1, 7)];
  const cloud = [
    { snapshot: snapshot(t0, 5) },
    { snapshot: snapshot(t1, 2) },
    { snapshot: snapshot(t2, 9) },
    { snapshot: { schemaVersion: 99, capturedAt: 'not-a-date' } }
  ];
  const result = inspectWorkforceTrendCloudConflictsV802(local, cloud);
  assert.deepEqual({
    localCount: result.localCount,
    cloudCount: result.cloudCount,
    localOnlyCount: result.localOnlyCount,
    cloudOnlyCount: result.cloudOnlyCount,
    identicalCount: result.identicalCount,
    conflictCount: result.conflictCount
  }, {
    localCount: 2,
    cloudCount: 3,
    localOnlyCount: 0,
    cloudOnlyCount: 1,
    identicalCount: 1,
    conflictCount: 1
  });
  assert.deepEqual(result.conflictCapturedAt, [t1]);
  assert.deepEqual(result.cloudOnlyCapturedAt, [t2]);
});

test('conflict inspector rejects unapproved extra fields before comparing snapshots', () => {
  const local = [snapshot(t0, 5, { privateNote: 'private' })];
  const cloud = [{ snapshot: snapshot(t0, 5) }];
  const result = inspectWorkforceTrendCloudConflictsV802(local, cloud);
  assert.equal(result.identicalCount, 1);
  assert.equal(result.conflictCount, 0);
});

test('merge keeps the local copy at colliding timestamps while preserving cloud-only rows', () => {
  const merged = mergeWorkforceTrendCloudHistoryV802(
    [snapshot(t0, 8)],
    [{ snapshot: snapshot(t0, 1) }, { snapshot: snapshot(t1, 4) }]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged.find(row => row.capturedAt === t0).summary.completedReplies, 8);
  assert.equal(merged.find(row => row.capturedAt === t1).summary.completedReplies, 4);
});

test('RPC result parser bounds counters and normalises conflict timestamps', () => {
  const result = parseWorkforceTrendCloudSyncResultV802(JSON.stringify({
    inserted: 3.9,
    unchanged: 95,
    conflicts: 2,
    conflictCapturedAt: [t0, 'invalid', t1]
  }));
  assert.deepEqual(result, {
    inserted: 3,
    unchanged: 90,
    conflicts: 2,
    conflictCapturedAt: [t0, t1]
  });
  assert.throws(() => parseWorkforceTrendCloudSyncResultV802('not-json'), /invalid result/);
});

test('cloud sync plugin calls the conflict-reporting RPC and warns rather than overwriting', () => {
  const source = [
    '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */',
    "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';",
    '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>',
    'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
    'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.'
  ].join('\n');
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const transformed = plugin.transform.call({ warn: message => { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(transformed?.code);
  assert.match(transformed.code, /workforce-trend-cloud-sync-engine-v802\.js/);
  assert.match(transformed.code, /calloria_sync_workforce_trend_snapshots_v802/);
  assert.match(transformed.code, /inspectWorkforceTrendCloudConflictsV802/);
  assert.match(transformed.code, /"warning"/);
  assert.doesNotMatch(transformed.code, /rpc\("calloria_save_workforce_trend_snapshots"/);
  assert.equal(plugin.transform(source, '/repo/js/other.js'), null);
  assert.equal(plugin.transform(`${source}\n/* CALLORIA_V801_WORKFORCE_TREND_CLOUD_SYNC */`, '/repo/js/main.js'), null);
});

test('conflict-guard migration makes both RPC contracts non-destructive and organisation-scoped', () => {
  const sql = read('supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql');
  assert.match(sql, /create or replace function public\.calloria_save_workforce_trend_snapshots\(/);
  assert.match(sql, /create or replace function public\.calloria_sync_workforce_trend_snapshots_v802\(/);
  assert.equal((sql.match(/on conflict \(organization_id, captured_at\) do nothing/gi) || []).length, 2);
  assert.doesNotMatch(sql, /on conflict \(organization_id, captured_at\) do update/i);
  assert.match(sql, /public\.has_calloria_org_permission\(p_org_id, 'reports:read'\)/);
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /v_existing is distinct from v_snapshot/);
  assert.match(sql, /v_existing is not distinct from v_snapshot/);
  assert.match(sql, /'inserted', v_inserted/);
  assert.match(sql, /'unchanged', v_unchanged/);
  assert.match(sql, /'conflicts', v_conflicts/);
  assert.match(sql, /grant execute on function public\.calloria_sync_workforce_trend_snapshots_v802\(uuid, jsonb\) to authenticated/);
  assert.match(sql, /revoke all on function public\.calloria_sync_workforce_trend_snapshots_v802\(uuid, jsonb\) from public, anon/);
  assert.doesNotMatch(sql, /create table|alter table|drop table/i);
});

test('production preflight and integration audit now require v8.3 cloud-conflict files', () => {
  const audit = read('tools/calloria-v8-integration-audit.mjs');
  const preflight = read('tools/calloria-build-preflight.mjs');
  const pkg = JSON.parse(read('package.json'));
  for (const file of [
    'js/workforce-trend-cloud-sync-engine-v802.js',
    'supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql',
    'tests/workforce-trend-cloud-sync-v802.test.mjs'
  ]) {
    assert.ok(audit.includes(file));
    assert.ok(preflight.includes(file));
  }
  assert.match(audit, /calloria_sync_workforce_trend_snapshots_v802/);
  assert.match(pkg.scripts['verify:workforce-cloud-history'], /workforce-trend-cloud-sync-v802\.test\.mjs/);
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
});
