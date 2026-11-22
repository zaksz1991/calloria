import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloudTrendRowsToSnapshotsV801,
  mergeWorkforceTrendCloudHistoryV801,
  prepareWorkforceTrendCloudPayloadV801,
  WORKFORCE_TREND_CLOUD_TABLE,
  WORKFORCE_TREND_CLOUD_SAVE_RPC
} from '../js/workforce-trend-cloud-sync-engine-v801.js';

function snapshot(capturedAt, completedReplies, extra = {}) {
  return {
    schemaVersion: 1,
    capturedAt,
    sourceVersion: '7.31.0',
    summary: {
      digitalAgents: 2,
      completedReplies,
      openDigitalWork: 3,
      overdueDigitalWork: 1,
      atRiskDigitalWork: 0,
      responseTargetRate: 92.5,
      workstreamsAvailable: 3,
      departmentsAvailable: 1,
      agentsNeedingSupervisorAttention: 1,
      departmentCoveragePercent: 50,
      mappedDepartmentAgents: 1,
      identifiedDigitalAgents: 2,
      privateNote: 'must not persist'
    },
    workstreams: [{ id: 'email', label: 'Email', available: true, completed: completedReplies, open: 2, overdue: 1, atRisk: 0, responseTargetRate: 90, employeeId: 'must-not-persist' }],
    departments: [{ department: 'Customer Care', agents: 2, completed: completedReplies, open: 2, overdue: 1, atRisk: 0, responseTargetRate: 90, employeeIds: ['x'] }],
    ...extra
  };
}

test('cloud adapter exposes only validated snapshots from Supabase rows', () => {
  const rows = [
    { snapshot: snapshot('2026-11-20T10:00:00.000Z', 4) },
    { snapshot: { schemaVersion: 99, capturedAt: 'invalid' } },
    null
  ];
  const result = cloudTrendRowsToSnapshotsV801(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].summary.completedReplies, 4);
  assert.equal('privateNote' in result[0].summary, false);
  assert.equal('employeeId' in result[0].workstreams[0], false);
  assert.deepEqual(Object.keys(result[0].departments[0]).sort(), ['agents', 'atRisk', 'completed', 'department', 'open', 'overdue', 'responseTargetRate'].sort());
});

test('local snapshots take precedence on identical capture time during merge', () => {
  const time = '2026-11-20T10:00:00.000Z';
  const local = [snapshot(time, 9)];
  const cloud = [{ snapshot: snapshot(time, 4) }, { snapshot: snapshot('2026-11-19T10:00:00.000Z', 2) }];
  const result = mergeWorkforceTrendCloudHistoryV801(local, cloud);
  assert.equal(result.length, 2);
  assert.equal(result.find(row => row.capturedAt === time).summary.completedReplies, 9);
});

test('cloud payload is validated, timestamp-deduplicated and capped at 90', () => {
  const records = Array.from({ length: 96 }, (_, index) => snapshot(new Date(Date.UTC(2026, 0, index + 1)).toISOString(), index));
  records.push(snapshot(new Date(Date.UTC(2026, 0, 96)).toISOString(), 999));
  const result = prepareWorkforceTrendCloudPayloadV801(records);
  assert.equal(result.length, 90);
  assert.equal(result.at(-1).summary.completedReplies, 999);
  assert.equal(result.some(row => 'privateNote' in row.summary), false);
});

test('cloud table and RPC names are stable and CALLORIA scoped', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_TABLE, 'calloria_workforce_trend_snapshots');
  assert.equal(WORKFORCE_TREND_CLOUD_SAVE_RPC, 'calloria_save_workforce_trend_snapshots');
  assert.match(WORKFORCE_TREND_CLOUD_TABLE, /^calloria_/);
});
